import { ShapeFlags } from '@vue/shared';
import { ReactiveEffect } from 'packages/reactivity/src/effect';
import { createAppApi } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component';
import { isSameVNodeType, normalizeVNode, Text } from './createVnode';


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
                let nextTree = instance.render.call(proxy,proxy);
                patch(prevTree,nextTree,container)
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
    let mountElement = (vnode, container) => { // 把虚拟节点挂载到真实节点上.
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
        if(props){
            for(let key in props){
                hostPatchProp(el,key,null,props[key]); // 给元素添加属性
            }
        }


        hostInsert(el,container)
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

    let patchProps = (oldProps,newProps,el)=>{
        // 比对属性
        // 相同直接返回
        if(oldProps===newProps)return;
        // 新旧不一样
        for(let key in newProps){
            let prev = oldProps[key];
            let next = newProps[key];
            if(prev !== next){ 
                hostPatchProp(el,key,prev,next);
            }
        };
        // 老的有,新的没有
        for(let key in oldProps){
            let prev = oldProps[key];
            let next = newProps[key];
             
            if(!next){ 
                hostPatchProp(el,key,prev,null);
            }
        };
    }
    
    let  unmoutChildren = (children)=>{
        for(let i = 0;i < children.length;i++){
            unmout(children[i]); // 每个都卸载掉 dom
        }
    }

    let patchKeyedChildren = (c1,c2,el)=>{ // 处理带key的节点
        console.log(c1);
        console.log(c2);
        console.log(el);
        
    }

    let patchChildren = (n1,n2,el)=>{ // 用新得儿子n2和老的儿子n1 进行比对, 比对后更新容器元素
        let c1 = n1 && n1.children; // 老儿子
        let c2 = n2 && n2.children; // 新儿子
        // 主要依靠两个类型来判断
        let prevShapeFlag =    n1.ShapeFlag; 
        let currentShapeFlag =    n2.ShapeFlag;

        // c1 和c2 儿子有哪些类型(使用shapeFlag)
        // 1. 之前的孩子是数组,现在是文本 => 把之前的数组都删除,添加文本
        // 2. 之前的孩子是数组,现在是数组 => 比较两个儿子列表的差异
        // 3. 之前的孩子是文本,现在是空的 => 删除老的即可
        // 4. 之前的孩子是文本,现在是文本 => 直接更新文本即可

        // 5. 之前的孩子是文本,现在是数组 => 删除文本,新增儿子
        // 6. 之前的孩子是空的,现在是文本 => 

        // 1. 现在是文本的情况 1 4解决
        if(currentShapeFlag& ShapeFlags.TEXT_CHILDREN){
            // 1. 之前是数组
            if(prevShapeFlag& ShapeFlags.ARRAY_CHILDREN){
                unmoutChildren(c1);
            }

            // 4. 之前是文本,之后也是文本 => 走到这的原因是: 外层限定现在是文本,如果是数组也卸载掉了,所以这里肯定是之前和现在都是文本, 那么就替换文本内容.
            if(c1 !== c2){ 

                hostSetElementText(el,c2)
            }
        }else{
            // 现在这里面就都是数组了
            if(prevShapeFlag & ShapeFlags.ARRAY_CHILDREN){
                // 2.说明之前是数组,现在也是数组 ******
                if(currentShapeFlag& ShapeFlags.ARRAY_CHILDREN){
                    // 比对两个数组的差异
                    patchKeyedChildren(c1,c2,el)
                }else{
                    // 之前是数组, 现在不是数组-就是空文本 => 需要把之前的都干掉
                    unmoutChildren(c1);
                }
            }else{
                // 之前是文本,清空所有孩子
                if(prevShapeFlag & ShapeFlags.TEXT_CHILDREN){
                    hostSetElementText(el,'')
                }
                // 之前是文本,现在是数组,挂载所有孩子
                if(currentShapeFlag & ShapeFlags.ARRAY_CHILDREN){
                    mountChildren(c2,el)
                }
            }
        }
    }
    let patchElement = (n1,n2)=>{
        // 1. 复用元素 2. 比较属性 3. 比较孩子
        let el =    n2.el = n1.el; // diff算法,
        let oldProps = n1.props || {};
        let newProps = n2.props || {};
        patchProps(oldProps,newProps,el)
        
        // 比较孩子 => diff孩子 => 有很多情况 ,我们的diff算法是同级别比较. 就是一个树形结构. 就是A根下面有b和c   A1根下有b1和c1 A和A1比较,b,c和b1,c1比较
        patchChildren(n1,n2,el); // 用新得儿子n2和老的儿子n1 进行比对
    }
    let processElement = (n1, n2, container) => {
        if (n1 === null) {
            // 元素的初始化,因为首个元素是空
            mountElement(n2, container)
        } else {
            // 元素的diff算法 
            patchElement(n1,n2); // 更新两个元素之间的差异
        }
    }

    let processText = (n1,n2,container)=>{
        if(n1 === null){
            // 文本的初始化
                let textNode =   hostCreateText(n2.children);
                n2.el = textNode
                hostInsert(textNode,container)
        }else{
            
        }
    }

    let unmout = (vnode)=>{ // 直接删除掉真实节点
        hostRemove(vnode.el)
    }

    let patch = (n1, n2, container) => {

        // 第一种: 两个元素完全没有关系
        if(n1 && !isSameVNodeType(n1,n2)){ // 是否相同节点,如果是相同节点走diff. 不是相同节点删除原来dom节点,并且把n1参数清空为null,
            unmout(n1);
            n1 = null; // 只要是null,就会走初始化流程
        } else{
            
        }
        
        if (n1 === n2) return;
        let { ShapeFlag, type } = n2;
        switch (type) {
            case Text:
                processText(n1,n2,container);
                break;
            default:
                if (ShapeFlag & ShapeFlags.COMPONENT) { // 组件需要处理
                    processComponent(n1, n2, container)
                } else if (ShapeFlag & ShapeFlags.ELEMENT) { // 如果当前类型是元素的话
                    processElement(n1, n2, container)
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