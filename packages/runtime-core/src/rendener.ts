import { ShapeFlags } from '@vue/shared';
import { ReactiveEffect } from 'packages/reactivity/src/effect';
import { createAppApi } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component';
import { isSameVNodeType, normalizeVNode, Text } from './createVnode';
function getSequence(arr) {
    let len = arr.length; // 获取长度
    let result = [0]; // 这里放的是索引,0就是arr的第一个值 => 1
    let lastIndex; // 最后一个值的索引
    let preNode = arr.slice(0); // 用来记录前驱节点的索引,用来追溯正确的顺序
    // 二分查找的三个指针
    let start;
    let end;
    let middle;

    // 1. 直接看元素 如果比当前的末尾大,直接追加
    for (let i = 0; i < len; i++) {
        console.log('xxxx');
        let arrI = arr[i]; // 获取的是每一个值,但是这里命名为arrI感觉不符合. 而且结果也是值,并不是索引
        if (arrI !== 0) { // 如果是0就不记录了,因为这个是新增.不用考虑
            lastIndex = result[result.length - 1]; // 获取结果集中的最后一个
            if (arr[lastIndex] < arrI) { // 当前项和最后一项比较大小,就追加

                // 记录当前元素的前一个人的索引
                preNode[i] = lastIndex;

                result.push(i);
                continue
            }
        }

        // 2. 二分查找
        start = 0;
        end = result.length - 1;
        while (start < end) {
            middle = ((start + end) / 2) | 0;
            if (arr[result[middle]] < arrI) {
                start = middle + 1;
            } else {
                end = middle;
            }
        }

        // console.log(result[start] === middle);

        if (arrI < arr[result[start]]) {

            // 这里替换之前 应该让当前元素的索引替换
            preNode[i] = result[start - 1]; // 用找到的索引,标记到p上 // 感觉这块就是把所以从后到前做个重置


            result[start] = i;
        } else {
            // 只有首次 既不记录使用: 1.末尾追加 也不 2. 二分查找
            console.log(333);
        }
        // console.log(result);

    }


    // 3. 最后从后往前追溯 [2,1,8,4,6,7]
    let i = result.length; // 拿到最后一个 开始向前追溯
    let last = result[i - 1]; // 就是索引里最后一个--就是result数组的最后一个
    // debugger // [2,1,8,4,6,7]
    while (i-- > 0) { // 倒叙往前查找 // 通过前驱节点 找到正确的调用顺序,就是正确值是从从来找来的
        // 每个索引都是用来更新每个节点 一直换来换去
        result[i] = last; // 每次换掉result里的值为真正的值 // 最后一项肯定是正确的,所以使用倒叙来从最后一项向前查找
        last = preNode[last]; //
    }
    return result
}


// 所有渲染逻辑,更新+ 挂载+ 处理+ 挂载孩子+ 挂载元素

// runtime-core不依赖平台代码,因为平台代码都是传入的(比如runtime-dom)
export function createRenderer(renderOptions) {
    const {
        insert: hostInsert,
        remove: hostRemove,
        patchProp: hostPatchProp,
        createElement: hostCreateElement,
        createText: hostCreateText,
        createComment: hostCreateComment,
        setText: hostSetText,
        setElementText: hostSetElementText,
        parentNode: hostParentNode,
        nextSibling: hostNextSibling,
    } = renderOptions;

    /*  
    拆包的逻辑 -> 有了这几个属性: 
        runtimeDom的所有APi: renderOptions
        有了要渲染的组件:     rootComponent
        有了组件的所有属性    rootProps
        有了最后的容器        container */
    // 都是渲染逻辑的就会包裹在这个函数里,如果是其他逻辑的才会拆出去

    let setupRenderEffect = (initialVnode, instance, container) => {
        // 创建渲染effect

        // 核心就是调用render,  是基于数据变化就调用render
        let componentUpdateFn = () => {
            let { proxy } = instance; // render中的那个参数
            // 判断下是否挂载过 
            if (!instance.isMounted) {
                // 组件初始化流程

                // 渲染的时候会调用h方法
                let subTree = instance.render.call(proxy, proxy); // 出发是effect触发,effect触发说明是初始化或者属性变化,这个时候就函数的render从新执行.
                // subTree还是一个虚拟节点,因为如果是h渲染的 返回值就是虚拟节点.

                instance.subTree = subTree; // render的执行结果就是subTree,放在实例上就可以.
                // 真正渲染组件,是渲染subTree(就是一个虚拟节点). patch就是渲染虚拟节点用的
                patch(null, subTree, container); // 稍后渲染完subTree会生成真实节点,之后需要挂载到subTree上.------这个可能在patch里操作了?
                initialVnode.el = subTree.el; // 把真实节点放到实例上存储.

                instance.isMounted = true; // 挂载完就修改属性
            } else {
                // 组件更新流程
                // 可以做更新的时候,做diff算法
                let prevTree = instance.subTree; // 上次的树
                let nextTree = instance.render.call(proxy, proxy);
                patch(prevTree, nextTree, container)
            }
        }
        let effect = new ReactiveEffect(componentUpdateFn); //就是effect,会记录使用的属性. 属性变化就会让这个函数执行.

        let update = effect.run.bind(effect); // 绑定this
        update(); // 初始化就调用一遍更新,这个调用就是走的componentUpdateFn函数,因为给ReactiveEffect传入的函数是这个. 初始化run的时候是让this.fn(源码里)
    }

    let mountComponent = (initialVnode, container) => {

        // 挂载组件分3步骤
        // 1. 我们给组件创造一个组件的实例(一个对象,有n多空属性)
        let instance = initialVnode.component = createComponentInstance(initialVnode); // 创建的是实例,会给到虚拟节点的组件上,然后再给到当前这个变量instance
        // 2. 需要给组件的实例做赋值操作
        setupComponent(instance); // 给实例赋予属性

        // 3. 调用组件的render方法, 实现组件的渲染逻辑 
        // 如果组件依赖的状态发生变化,组件要重新渲染(响应式)
        // effect reactive => 数据变化,effect自动自行. 
        setupRenderEffect(initialVnode, instance, container) // 渲染的effect

    }
    let mountElement = (vnode, container, anchor) => { // 把虚拟节点挂载到真实节点上.
        // vnode可能是字符串,可以可能是对象数组/字符串数组,因为在h方法的时候区分了
        let { type, props, children, ShapeFlag } = vnode; // 获取节点的类型 属性 儿子的形状= 文本,数组
        let el = vnode.el = hostCreateElement(type);
        // hostInsert(el, container);

        if (ShapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(el, children); // 因为类型是文本,所以孩子是字符串
        } else if (ShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            mountChildren(children, el); // 儿子不能循环挂载
        }

        // 处理属性
        if (props) {
            for (let key in props) {
                hostPatchProp(el, key, null, props[key]); // 给元素添加属性
            }
        }


        hostInsert(el, container, anchor)
    }



    let mountChildren = (children, container) => {
        // 儿子不能循环挂载,
        // 1. 因为可能多个文本,需要先创建为虚拟节点.
        // 2. 为了节省性能不能多次传入,而是使用 fragment存储 一次性传入 可以节省性能

        for (let i = 0; i < children.length; i++) {
            let child = (children[i] = normalizeVNode(children[i])); // 如果是字符串,变成对象

            // 这个地方是会递归patch,每个孩子都会处理. 深度优先
            // 都成为了虚拟节点后,使用patch创建元素
            patch(null, child, container); // 如果是文本节点,在patch里有switch区分,然后做特殊处理(只是把字符串做成了文本)

        }

    }

    let processComponent = (n1, n2, container) => {
        if (n1 === null) {
            // 组件的初始化,因为首个元素是空
            mountComponent(n2, container)
        } else {
            // 组件的更新
        }
    }

    let patchProps = (oldProps, newProps, el) => {
        // 比对属性
        // 相同直接返回
        if (oldProps === newProps) return;
        // 新旧不一样
        for (let key in newProps) {
            let prev = oldProps[key];
            let next = newProps[key];
            if (prev !== next) {
                hostPatchProp(el, key, prev, next);
            }
        };
        // 老的有,新的没有
        for (let key in oldProps) {
            let prev = oldProps[key];
            let next = newProps[key];

            if (!next) {
                hostPatchProp(el, key, prev, null);
            }
        };
    }

    let unmoutChildren = (children) => {
        for (let i = 0; i < children.length; i++) {
            unmout(children[i]); // 每个都卸载掉 dom
        }
    }
    let patchKeyedChildren = (c1, c2, container) => { // 处理带key的节点
        // 永远记住,是比对的索引
        let e1 = c1.length - 1; // 老儿子最后一个数值的索引
        let e2 = c2.length - 1; // 新儿子最后一个数值的索引
        let i = 0; // 指针i,从头开始用,每次循环+1, 直到e1或者e2的较短长度为止. ---多的就是另外一次循环的值?


        // 1. sync from start 从头开始比较
        while (i <= e1 && i <= e2) {
            /* 
            概念: e1或者e2里,只循环最短值就行 多余的从后面循环
            代码: i指针和e1或e2的指针重合就结束循环
            */
            let n1 = c1[i];
            let n2 = c2[i];

            if (isSameVNodeType(n1, n2)) {// 判断类型相同
                patch(n1, n2, container); // 递归判断孩子和属性是否相同
            } else {
                break; // 不同就打断循环了
            }
            i++
        }

        // 2. sync from end 从尾比较 其实就是倒叙比较
        while (i <= e1 && i <= e2) {
            let n1 = c1[e1]; // 取值不是使用索引,而是使用孩子总数,就是最后一个
            let n2 = c2[e2]; // 取值不是使用索引,而是使用孩子总数,就是最后一个

            if (isSameVNodeType(n1, n2)) {// 判断类型相同
                patch(n1, n2, container); // 递归判断孩子和属性是否相同
            } else {
                break; // 不同就打断循环了
            }
            e1--;
            e2--; // 和sync from start 区别就是这里
        }
        // 1console.log(e1,e2,i,'------');  // 定位了除了头部和尾部的节点


        // 3. common sequent mount(同序列挂载)  
        // 此时的i和e1,e2分别是  两个数组的前置索引和后置索引 也就是空出来中间没办法比对的索引
        // 1console.log(i,e1,e2,'------');  // 定位了除了头部和尾部的节点
        // 看i和e1的区别,如果i>e1(老儿子),说明新索引大于老儿子的数量,就有新增元素 
        // 新增的元素 就是i 和e2(新儿子)之间的内容就是新增的
        if (i > e1) {
            // 说明有新增的元素
            if (i <= e2) {
                let nextPos = e2 + 1;
                // 取e2的下一个元素 如果下一个没有 则长度和当前c2的长度相同 说明追加在后面
                // 取e2的下一个元素 如果下一个有值 说明追加在anchor前面
                let anchor = nextPos < c2.length ? c2[nextPos].el : null;

                while (i <= e2) { // 把之间的差距都新增 
                    patch(null, c2[i], container, anchor); // 没有参照物,就是appendChild.所以-1的bug就会出现 50: diff算法基本比对优化
                    i++;
                }
            }
        } else if (i > e2) { // 老的元素多, 新的元素少,,少出掉多的元素
            // 4.common sequence + unmount
            while (i <= e1) {
                unmout(c1[i]);
                i++;
            }

        }


        // 5. unknown sequence
        // s1/s2是老/新孩子的左边
        // e1/e2是老/新孩子的索引
        // c1就是老孩子的数组
        // c2就是新孩子的数组
        let s1 = i; // 老的孩子的列表的索引
        let s2 = i; // 新的孩子的列表的索引

        // 根据新的节点创建一个映射表,用老的列表去里面找有没有, 有则复用.没有就删除元素  最后新的就是追加元素
        // 这个地方存储新key,用来查看老的有没有可以复用新的.
        let keyToNewIndexMap = new Map(); // key和索引做一个map映射表
        for (let i = s2; i <= e2; i++) { // s2开始(从新孩子左边开始) 到e2结束(老孩子的右边)
            let child = c2[i]; // 新孩子循环每一个
            keyToNewIndexMap.set(child.key, i); // 每个孩子的key做索引,i做值(每个新孩子的索引做值)
        }



        // 做一个数组,记录新增的元素. 直接填充0 ,任何一个有值,就改为值.  最后判定非0的都是新增的索引.
        let toBePatched = e2 - s2 + 1; // 新孩子长度 - 新孩子索引 + 1 => 总结计算:就是 新孩子左边开始的位置
        let newIndextoOldMapIndex = new Array(toBePatched).fill(0); // 把toBePatched作为数组长度,每个填充为0;




        // 拿老的每一个节点,去映射表里找; 
        // http://www.javascriptpeixun.cn/course/3365/task/254218/show   这个地方要是不懂还是看看51集
        for (let i = s1; i <= e1; i++) {
            let prevChild = c1[i];
            let newIndex = keyToNewIndexMap.get(prevChild.key);
            // 1console.log(newIndex);
            if (newIndex === undefined) {
                unmout(prevChild) // 老的元素里有,但是新列表里没有. 就删除掉这个元素
            } else {
                // 这里面存储的是老节点的索引, 5,3,4,0是老索引里+1的值. => 第一个5是5,实际是循环老数组,到了e 这里的时候是老节点里的索引4+1; => 总结: 还是左边是新节点,循环的是老节点,每找到一个新节点,就把老数组里的位置放到新数组里存储.
                // newIndextoOldMapIndex[newIndex - s2]这是新索引的位置, 右边i+1是老索引的位置(可能不太对,但是可以对比一下---后面再看还是对的)
                newIndextoOldMapIndex[newIndex - s2] = i + 1; // 新索引的数组对照的索引部分,放到[0,0,0]对照老索引里,找到新增的元素 // + 1保证永远不会填写0,至少是1. 后面使用的时候要减少1.


                // 比较两个节点的属性等.
                patch(prevChild, c2[newIndex], container); // 填表后还要比对属性和儿子
            }
        }

        let queue = getSequence(newIndextoOldMapIndex); // 求出队列 [1,2]=> 索引是连续的,且不用动的
        console.log(queue);

        let j = queue.length - 1; // 最长递增子序列的末尾索引

        // 位置做插入
        // 使用toBepatched倒叙插入
        for (let i = toBePatched - 1; i >= 0; i--) { //  toBePatched - 1就是索引,不减1就是长度 // i>=0是要倒叙,反向插入
            let lastIndex = s2 + i; // s2 + i 就是 左侧的已经比对的索引 + 循环的索引,就是整个数组//  老师说的,不太懂啥事: h的索引
            let lastChild = c2[lastIndex]; // 新孩子里,没排序里的最右侧的孩子

            let anchor = lastIndex + 1 < c2.length ? c2[lastIndex + 1].el : null // 如果最后一个索引+ 1还有值, 说明不是数组最后一位,后面还有人可以取值. 如果后面没值了,说明是最后一个.  可能就是dom的appendChild和insert有anchor的区别

            if (newIndextoOldMapIndex[i] === 0) { // 拿着新数组里的索引去老索引里找,有就是有可复用元素,没有就是不存在元素

                // 这里if使用patch是因为不存在这个节点,而下面的else是已经存在节点,只是修改dom元素
                patch(null, c2[lastIndex], container, anchor); // 如果是新增元素,就是使用patch创建一个元素,插入当前元素里
            } else {
                // 这里可以进行性能优化 因为有一些节点不需要移动,到那时还是全部插入了一遍.
                // 最长递增子序列,减少dom的插入操作

                // 此处开始倒叙的插入.每一个孩子(这些孩子都是复用的) -- 直接插入是性能损耗大,需要最长递增子序列后 dom操作改到最少再操作

                // 3-2-1-0 => 倒叙 
                if (i !== queue[j]) { // 索引不同,说明没法优化直接插入.
                    hostInsert(lastChild.el, container, anchor); // 将列表倒叙的插入
                }else{ // 相同的索引说明可以复用
                    j--; // 相当于当前元素直接操作,就把循环减少就行.  // 这里是个优化,标识元素不需要移动了
                }
            }


            // hostInsert(c2[newIndextoOldMapIndex[i]],container,)
        }



    }

    let patchChildren = (n1, n2, el) => { // 用新得儿子n2和老的儿子n1 进行比对, 比对后更新容器元素
        let c1 = n1 && n1.children; // 老儿子
        let c2 = n2 && n2.children; // 新儿子
        // 主要依靠两个类型来判断
        let prevShapeFlag = n1.ShapeFlag;
        let currentShapeFlag = n2.ShapeFlag;

        // c1 和c2 儿子有哪些类型(使用shapeFlag)
        // 1. 之前的孩子是数组,现在是文本 => 把之前的数组都删除,添加文本
        // 2. 之前的孩子是数组,现在是数组 => 比较两个儿子列表的差异
        // 3. 之前的孩子是文本,现在是空的 => 删除老的即可
        // 4. 之前的孩子是文本,现在是文本 => 直接更新文本即可

        // 5. 之前的孩子是文本,现在是数组 => 删除文本,新增儿子
        // 6. 之前的孩子是空的,现在是文本 => 

        // 1. 现在是文本的情况 1 4解决
        if (currentShapeFlag & ShapeFlags.TEXT_CHILDREN) {
            // 1. 之前是数组
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                unmoutChildren(c1);
            }

            // 4. 之前是文本,之后也是文本 => 走到这的原因是: 外层限定现在是文本,如果是数组也卸载掉了,所以这里肯定是之前和现在都是文本, 那么就替换文本内容.
            if (c1 !== c2) {

                hostSetElementText(el, c2)
            }
        } else {
            // 现在这里面就都是数组了
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                // 2.说明之前是数组,现在也是数组 ******
                if (currentShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    // 比对两个数组的差异
                    patchKeyedChildren(c1, c2, el)
                } else {
                    // 之前是数组, 现在不是数组-就是空文本 => 需要把之前的都干掉
                    unmoutChildren(c1);
                }
            } else {
                // 之前是文本,清空所有孩子
                if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
                    hostSetElementText(el, '')
                }
                // 之前是文本,现在是数组,挂载所有孩子
                if (currentShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    mountChildren(c2, el)
                }
            }
        }
    }
    let patchElement = (n1, n2) => {
        // 1. 复用元素 2. 比较属性 3. 比较孩子
        let el = n2.el = n1.el; // diff算法,
        let oldProps = n1.props || {};
        let newProps = n2.props || {};
        patchProps(oldProps, newProps, el)

        // 比较孩子 => diff孩子 => 有很多情况 ,我们的diff算法是同级别比较. 就是一个树形结构. 就是A根下面有b和c   A1根下有b1和c1 A和A1比较,b,c和b1,c1比较
        patchChildren(n1, n2, el); // 用新得儿子n2和老的儿子n1 进行比对
    }
    let processElement = (n1, n2, container, anchor) => {
        if (n1 === null) {
            // 元素的初始化,因为首个元素是空
            mountElement(n2, container, anchor)
        } else {
            // 元素的diff算法 
            patchElement(n1, n2); // 更新两个元素之间的差异
        }
    }

    let processText = (n1, n2, container) => {
        if (n1 === null) {
            // 文本的初始化
            let textNode = hostCreateText(n2.children);
            n2.el = textNode
            hostInsert(textNode, container)
        } else {

        }
    }

    let unmout = (vnode) => { // 直接删除掉真实节点
        hostRemove(vnode.el)
    }

    let patch = (n1, n2, container, anchor = null) => {

        // 第一种: 两个元素完全没有关系
        if (n1 && !isSameVNodeType(n1, n2)) { // 是否相同节点,如果是相同节点走diff. 不是相同节点删除原来dom节点,并且把n1参数清空为null,
            unmout(n1);
            n1 = null; // 只要是null,就会走初始化流程
        } else {

        }

        if (n1 === n2) return;
        let { ShapeFlag, type } = n2;
        switch (type) {
            case Text:
                processText(n1, n2, container);
                break;
            default:
                if (ShapeFlag & ShapeFlags.COMPONENT) { // 组件需要处理
                    processComponent(n1, n2, container)
                } else if (ShapeFlag & ShapeFlags.ELEMENT) { // 如果当前类型是元素的话
                    processElement(n1, n2, container, anchor)
                }
        }
        // switch (type) {
        //     case value:

        //         break;

        //     default:
        //         break;
        // }

    }

    let render = (vnode, container) => { // render就是给一个虚拟节点,渲染到哪里就可以了. 将虚拟节点转化为真实节点,渲染到容器中


        // 后续还有更新 patch方法 包含初次渲染 和更新
        patch(null, vnode, container) // prevVnode(上次虚拟节点,没有就是初次渲染),node(本次渲染节点),container(容器)
    }
    return {
        createApp: createAppApi(render), // 创建一个CreateApp方法
        render
    }
}