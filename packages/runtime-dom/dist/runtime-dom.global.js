var VueRuntimeDOM = (function (exports) {
    'use strict';

    const effectStack = []; // effect: 目的是保证effect可以存储正确的effect执行关系
    let activeEffect; // 当前激活的effect
    function cleanUpEffect(effect) {
        let { deps } = effect;
        for (let dep of deps) {
            dep.delete(effect); // 老师解释: 让属性对应的effect移除掉, 就不会触发这个effect从新执行了.
            // 我的想法: 就是把当前的deps里的每个set里,删除this(effect). 
            // 解释: 每个dep就是set
            // 后面再理解: deps就是属性对应的set,删除掉属性里的set,以后再次调用属性,就不会触发对应的effect执行(因为已经删除了)
        }
    }
    class ReactiveEffect {
        constructor(fn, schduler) {
            this.fn = fn;
            this.schduler = schduler;
            this.active = true; // 功能: 记录当前effect是否激活可用,默认激活状态 写法: 在当前类上 this.active = true
            this.deps = []; // effect依赖那些属性
            this.run();
        }
        run() {
            if (!this.active) { // 非激活状态会执行fn函数
                return this.fn();
            }
            /*
            建立属性和effect之间的关系
            伪代码: 代码描述语言,方便被不同语言开发者所理解.
            effect1(()=>{
                state.name
                effect2(()=>{
                    state.age
                })
                state.c
            })
            1. 外层effect1会收集name,age两个属性
            2. 栈形结构执行完name,就会执行effect2. 这个时候activeEffect就会是effect2
            3. 如果是state.c的话,就会使用effect2的c,就会有问题

            解决办法: 使用栈结构-一个数组[e1,e2]:
                1. 取值永远最后一个栈来获取
                2. 执行e1的过程中,碰到了e2,就在栈的最后一位加入e2.
                3. 等到e2结束,就把栈的最后一位删除. 这个时候最后一位就又变回e1了



            activeEffect = effect1 ,代码执行.
            */
            try {
                if (!effectStack.includes(this)) { // 屏蔽同一个effect的执行\
                    effectStack.push(activeEffect = this); // 初始化会调用run方法,this就是当前effect
                    // 为了计算属性-添加的return
                    return this.fn(); // 这个函数执行的时候,就会触发属性访问,然后就会连锁触发proxy.get方法. 这个时候get里就可以得到当前effect是谁(因为先做的effectStack.push操作).
                }
            }
            finally {
                // 等到函数执行完毕后,就把栈中最后一项返回
                effectStack.pop(); // 最后一项删除掉,因为前面逻辑已经删除了
                activeEffect = effectStack[effectStack.length - 1]; // 最后一项最为选中项
            }
        }
        // 可以让effect
        stop() {
            // console.log(this,'stop');
            // 让dep里的effect删除掉,就可以了
            // effect.deps和属性没有关系
            if (this.active) { // 非激活状态不会执行
                cleanUpEffect(this); // 就是把当前收集的effect清理掉   再理解: 是把当前effect里记录的effect删除掉
                this.active = false;
            }
        }
    }
    function effect(fn) {
        let _effect = new ReactiveEffect(fn);
        _effect.run(); // 默认让fn执行一次
        let runner = _effect.run.bind(_effect); // 需求: effect返回的函数任何时候执行,就会立刻从新渲染effect函数. 处理: 将effect的run方法返回,并且绑定this. 
        runner.effect = _effect; // 使用一个属性存储实例,就可以直接使用实例上的原形方法.
        return runner;
    }
    function isTracking() {
        return activeEffect !== undefined;
    }
    let targetMap = new WeakMap();
    // 收集effect
    function track(target, key) {
        /*
        问题: 每次调用get,就是获取属性. 就可以得到target和key. 答案: 当时取值的this就是当时的effect,他就是依赖当前的effect
        数据格式:
        effect1(()=>{ // 只要访问属性的时候,这个时候记录当前的effect.
            state.name
            effect2(()=>{
                state.age
            })
            state.c
        })
        */
        // console.log(target, key, activeEffect);
        /*
        概念: 一个属性对应多个effect,一个effect依赖多个属性 => 多对多的关系
        数据格式:  {  使用weakMap,对象做参数,里面属性还是个对象的参数
                        对象: {
                            某个属性: [ effect1, effect2 ]
                        }
                   }
        */
        if (!isTracking()) { // 需要是在effect里执行的target.xxx字段,才会有acctiveEffect,才是在effect里面操作或者修改值,这种才要收集.其他的选择字段并不需要. 就要return掉
            return; // 双重取反 => 只要activeEffect是undefined就return
        }
        let depsMap = targetMap.get(target); // targetMap里面是否存储当前对象
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        let dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = new Set())); // {对象:{属性:set[]}}
        }
        trackEffects(dep);
    }
    function trigger(target, key) {
        let depsMap = targetMap.get(target);
        if (!depsMap)
            return; // 说明修改的属性根本没有依赖任何的effect
        let deps = []; // 存储的是[set,set]=>多个set
        if (key !== undefined) {
            let set = depsMap.get(key);
            deps.push(set);
        }
        let effects = [];
        for (let dep of deps) {
            effects.push(...dep); // 
        }
        triggerEffects(effects);
    }
    function triggerEffects(dep) {
        // 循环dep,让每个dep执行.
        for (let effect of dep) { // 把每个effect取出
            if (effect !== activeEffect) { // 如果当前effect执行和要执行的effect是同一个,就不执行了,防止循环
                if (effect.schduler) { // 如果有schduler,就走这个逻辑
                    return effect.schduler();
                }
                effect.run(); // 执行effect,重新渲染数据
            }
        }
    }
    function trackEffects(dep) {
        let shouldTrack = !dep.has(activeEffect);
        if (shouldTrack) { // 没有当前actvieEffect,就添加上
            dep.add(activeEffect); //set.add方法 => 把属性记录在实例的dep里,也就是说本身属性依赖的effect用一个set存储
            activeEffect.deps.push(dep); // 当前effect记录了最里层set,set里装的是 [effect],不太明白这个地方??  ---再理解: 其实就是把当前的effect.deps里记录了属性记录的所有set[effect],等到用的时候就知道是哪个set[effect]了  --------最后执行的时候,还是拓展到一个数组里,循环执行.
        }
    }

    function isObject(obj) {
        return typeof obj === 'object' && !Array.isArray(obj);
    }
    function isFunction(val) {
        return typeof val === 'function';
    }
    function isString(val) {
        return typeof val === 'string';
    }
    // 二进制是010101组成的,是每移动一位就成了另外一个样子  00001=> 就是00010
    // | 的能力是: 100 | 10 只要是有1就是1  结果: 110
    // & 的能力是: 100 & 10 必须是两个都是1 结果: 000 ,而用110 & 10 结果: 10 ,因为第二位的1是都有的,而100的1是只有一个.
    let hasOwnProperty = Object.prototype.hasOwnProperty;
    function hasOwn(value, key) {
        return hasOwnProperty.call(value, key);
    }

    function createVNode$1(type, props, children = null) {
        // 创建虚拟节点3元素 
        // 1. 创建的类型
        // 2. 节点的属性
        // 3. 孩子
        /*
         对象就是组件           {}
         字符串就是元素.        'div'
         不认识就是0            不知道的元素
          */
        let ShapeFlag = isObject(type) ? 6 /* COMPONENT */ : isString(type) ? 1 /* ELEMENT */ : 0;
        // 虚拟节点
        let vnode = {
            __v_isVnode: true,
            type,
            props,
            ShapeFlag,
            children,
            key: props && props.key,
            component: null,
            el: null, // 虚拟节点对应的真实节点
        };
        if (children) { // 如果有儿子,有两种情况 ['hello','zf'] / 'div'
            // 儿子分为几种类型, 如果是数组,类型就是数组儿子,如果是字符串,就是文本.
            // vnode就可以描述出来: 当前节点是一个什么节点,并且儿子是个什么节点. 
            // 稍后渲染虚拟节点的时候, 可以判断儿子是数组 就会循环渲染
            vnode.ShapeFlag = vnode.ShapeFlag | (isString(children) ? 8 /* TEXT_CHILDREN */ : 16 /* ARRAY_CHILDREN */); // 这个意思就是两个属性叠加在一起了, 
        }
        return vnode;
    }
    let Text = Symbol();
    function normalizeVNode(vnode) {
        // 规范化Vnode节点,就是把字符串/数字变成一个对象(虚拟节点对象)
        if (isObject(vnode)) {
            return vnode;
        }
        else {
            return createVNode$1(Text, null, String(vnode));
        }
    }
    function isSameVNodeType(n1, n2) {
        // 元素 div / span就是类型不一致  key目前是undefined所以不用使用
        return n1.type === n2.type && (n1.key === n2.key);
    }

    function createAppApi(render) {
        return (rootComponent, rootProps) => {
            let app = {
                mount(container) {
                    /* 挂载的核心:
                        1. 就是根据组件传入的对象,创造一个组件的虚拟节点
                        2. 在将这个虚拟节点渲染到容器中.
                    */
                    // 1. 创建组件的虚拟节点
                    let vnode = createVNode$1(rootComponent, rootProps); // h函数很像,给一个内容,创建一个虚拟节点
                    render(vnode, container);
                },
            };
            return app;
        };
    }

    function toReactive(value) {
        return isObject(value) ? reactive(value) : value;
    }
    let mutableHandler = {
        get(target, key, receiver) {
            if (key === "__v_isReactive" /* IS_REACTIVE */) {
                return true;
            }
            track(target, key);
            let res = Reflect.get(target, key, receiver); // 等价于target[key] 只不过使用Reflect.get获取,会有取值是否成功
            // 每次取值都可以收集当前值在哪个effect中
            return res;
        },
        set(target, key, value, receiver) {
            let oldValue = target[key]; // 获取老值
            let res = Reflect.set(target, key, value, receiver); // Reflect.set会返回是否设置成功
            if (oldValue !== value) { // 老值和新值不同,才触发更新
                // 每次改值都可以出发effect更新
                trigger(target, key); // 找到对应的effect,让他去执行更新
            }
            return res;
        }
    };
    // 弱引用对象,key必须是对象,如果key没有被引用,就会被自动销毁
    let reactiveMap = new WeakMap();
    // 只是区分是否浅的,是否仅读等四个参数来修改数据响应
    // readonly shallowReadonly shallowReactive
    // reactiveApi只针对对象才可以修改
    function createReactiveObject(target) {
        // 解决对象是否二次代理的问题: 先默认认为这个target已经代理过的属性,
        if (target["__v_isReactive" /* IS_REACTIVE */]) { // 这个指是get的时候,触发取值逻辑,强制返回true,这个地方才是true 返回target的
            // 初始化的时候,target.[xxx] 就会访问这个属性,但是因为是对象还不是proxy就还没生成这个对象,访问就是undefined,所以不会访问. 而二次访问就有这个属性了
            return target;
        }
        if (!isObject(target)) {
            return target;
        }
        let existProxy = reactiveMap.get(target); // 如果有缓存,就使用上次结果
        if (existProxy)
            return existProxy;
        let proxy = new Proxy(target, mutableHandler); // 当用户获取属性 或者修改属性的时候,我能劫持到 get/set
        reactiveMap.set(target, proxy);
        return proxy;
    }
    function reactive(target) {
        return createReactiveObject(target);
    }

    function createComponentInstance(vnode) {
        let type = vnode.type;
        const instance = {
            vnode,
            type,
            subTree: null,
            ctx: {},
            props: {},
            attrs: {},
            slots: {},
            setupState: {},
            propsOptions: type.props,
            proxy: null,
            render: null,
            emit: null,
            exposed: {},
            isMounted: false // 是否挂载完成
        };
        instance.ctx = { _: instance }; // 后续对他做一层代理
        return instance;
    }
    function initProps(instance, rawProps) {
        let props = {};
        let attrs = {};
        // 需要根据用户是否使用过这个属性,给他们命名.用过就是props,没用过就是attrs.
        let options = Object.keys(instance.propsOptions); // 就是用户当前组件上使用的props里的内容. 如果没有就是$attrs的内容.  
        if (rawProps) {
            for (let key in rawProps) {
                let value = rawProps[key];
                if (options.includes(key)) {
                    props[key] = value;
                }
                else {
                    attrs[key] = value;
                }
            }
        }
        instance.props = reactive(props); // props是响应式
        instance.attrs = (attrs); // attrs是非响应式的
    }
    function createSetupContext(instance) {
        return {
            attrs: instance.attrs,
            slots: instance.slots,
            emits: instance.emit,
            expose: (exposed) => {
                return instance.exposed = exposed || {};
            }
        };
    }
    let PbulicInstanceProxyHandlers = {
        // 这个代理的意义: 通过proxy代理,可以在访问对象的时候,直接取值setupState(以前的data)和props. 且有先后顺序
        get({ _: instance }, key) {
            // get(target,key){ // 这是一开始写的,但是解构的话减少赋值操作
            let { setupState, props } = instance;
            if (hasOwn(setupState, key)) {
                return setupState[key];
            }
            else if (hasOwn(props, key)) {
                return props[key];
            }
            else ;
        },
        set({ _: instance }, key, value) {
            let { setupState, props } = instance; // props不能修改
            if (hasOwn(setupState, key)) {
                setupState[key] = value;
            }
            else if (hasOwn(props, key)) {
                console.warn('Props are readonly');
                return false;
            }
            else ;
            return true;
        }
    };
    function setupStateFullComponent(instance) {
        // setup函数在实例的type里render函数
        let Component = instance.type;
        let { setup } = Component;
        // 这个proxy既能拿属性data,又能拿props,就类似vue2的this 
        // instance.ctx是写法是: instance.ctx = { _ : 一个instance }
        instance.proxy = new Proxy(instance.ctx, PbulicInstanceProxyHandlers); // 处理代理上下文的函数
        // console.log(instance.proxy.a,'2222')
        if (setup) {
            /*
            setup(第一个参数就是props,第二个参数就是attrs,emit,expose,slots集合) */
            let setupContext = createSetupContext(instance);
            let setupResult = setup(instance.props, setupContext);
            if (isFunction(setupResult)) {
                instance.render = setupResult; // 如果setup的是函数,他就是render函数
            }
            else if (isObject(setupResult)) {
                instance.setupState = setupResult; // 如果setup返回的是一个对象,他就是作为属性存储.
                // instance.render = 
            }
        }
        // console.log(instance.proxy.count,'count')
        if (!instance.render) {
            // 下个阶段解决的问题:  如果没有render, 写的template 可能要做模板编译 下个阶段会实现如何将tempalte贬称render函数
            instance.render = instance.type.render; // 如果没写setup的返回函数render,就采用组件本身的render.
        }
    }
    function setupComponent(instance) {
        let { attrs, props, children } = instance.vnode;
        // 组件的props做初始化, attrs也要初始化
        initProps(instance, props); // 将两个属性 props和attrs分别开来
        // 插槽的初始化 ,2022年3月28日10:38:39,说 后面做
        // initSlots(instance,children)....
        setupStateFullComponent(instance); // 这个方法的目的就是调用setup函数,得到用户的返回值.扩充setup和render函数 启动带状态的组件
    }

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
                    continue;
                }
            }
            // 2. 二分查找
            start = 0;
            end = result.length - 1;
            while (start < end) {
                middle = ((start + end) / 2) | 0;
                if (arr[result[middle]] < arrI) {
                    start = middle + 1;
                }
                else {
                    end = middle;
                }
            }
            // console.log(result[start] === middle);
            if (arrI < arr[result[start]]) {
                // 这里替换之前 应该让当前元素的索引替换
                preNode[i] = result[start - 1]; // 用找到的索引,标记到p上 // 感觉这块就是把所以从后到前做个重置
                result[start] = i;
            }
            else {
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
        return result;
    }
    // 所有渲染逻辑,更新+ 挂载+ 处理+ 挂载孩子+ 挂载元素
    // runtime-core不依赖平台代码,因为平台代码都是传入的(比如runtime-dom)
    function createRenderer(renderOptions) {
        const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, parentNode: hostParentNode, nextSibling: hostNextSibling, } = renderOptions;
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
                }
                else {
                    // 组件更新流程
                    // 可以做更新的时候,做diff算法
                    let prevTree = instance.subTree; // 上次的树
                    let nextTree = instance.render.call(proxy, proxy);
                    patch(prevTree, nextTree, container);
                }
            };
            let effect = new ReactiveEffect(componentUpdateFn); //就是effect,会记录使用的属性. 属性变化就会让这个函数执行.
            let update = effect.run.bind(effect); // 绑定this
            update(); // 初始化就调用一遍更新,这个调用就是走的componentUpdateFn函数,因为给ReactiveEffect传入的函数是这个. 初始化run的时候是让this.fn(源码里)
        };
        let mountComponent = (initialVnode, container) => {
            // 挂载组件分3步骤
            // 1. 我们给组件创造一个组件的实例(一个对象,有n多空属性)
            let instance = initialVnode.component = createComponentInstance(initialVnode); // 创建的是实例,会给到虚拟节点的组件上,然后再给到当前这个变量instance
            // 2. 需要给组件的实例做赋值操作
            setupComponent(instance); // 给实例赋予属性
            // 3. 调用组件的render方法, 实现组件的渲染逻辑 
            // 如果组件依赖的状态发生变化,组件要重新渲染(响应式)
            // effect reactive => 数据变化,effect自动自行. 
            setupRenderEffect(initialVnode, instance, container); // 渲染的effect
        };
        let mountElement = (vnode, container, anchor) => {
            // vnode可能是字符串,可以可能是对象数组/字符串数组,因为在h方法的时候区分了
            let { type, props, children, ShapeFlag } = vnode; // 获取节点的类型 属性 儿子的形状= 文本,数组
            let el = vnode.el = hostCreateElement(type);
            // hostInsert(el, container);
            if (ShapeFlag & 8 /* TEXT_CHILDREN */) {
                hostSetElementText(el, children); // 因为类型是文本,所以孩子是字符串
            }
            else if (ShapeFlag & 16 /* ARRAY_CHILDREN */) {
                mountChildren(children, el); // 儿子不能循环挂载
            }
            // 处理属性
            if (props) {
                for (let key in props) {
                    hostPatchProp(el, key, null, props[key]); // 给元素添加属性
                }
            }
            hostInsert(el, container, anchor);
        };
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
        };
        let processComponent = (n1, n2, container) => {
            if (n1 === null) {
                // 组件的初始化,因为首个元素是空
                mountComponent(n2, container);
            }
        };
        let patchProps = (oldProps, newProps, el) => {
            // 比对属性
            // 相同直接返回
            if (oldProps === newProps)
                return;
            // 新旧不一样
            for (let key in newProps) {
                let prev = oldProps[key];
                let next = newProps[key];
                if (prev !== next) {
                    hostPatchProp(el, key, prev, next);
                }
            }
            // 老的有,新的没有
            for (let key in oldProps) {
                let prev = oldProps[key];
                let next = newProps[key];
                if (!next) {
                    hostPatchProp(el, key, prev, null);
                }
            }
        };
        let unmoutChildren = (children) => {
            for (let i = 0; i < children.length; i++) {
                unmout(children[i]); // 每个都卸载掉 dom
            }
        };
        let patchKeyedChildren = (c1, c2, container) => {
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
                if (isSameVNodeType(n1, n2)) { // 判断类型相同
                    patch(n1, n2, container); // 递归判断孩子和属性是否相同
                }
                else {
                    break; // 不同就打断循环了
                }
                i++;
            }
            // 2. sync from end 从尾比较 其实就是倒叙比较
            while (i <= e1 && i <= e2) {
                let n1 = c1[e1]; // 取值不是使用索引,而是使用孩子总数,就是最后一个
                let n2 = c2[e2]; // 取值不是使用索引,而是使用孩子总数,就是最后一个
                if (isSameVNodeType(n1, n2)) { // 判断类型相同
                    patch(n1, n2, container); // 递归判断孩子和属性是否相同
                }
                else {
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
            }
            else if (i > e2) { // 老的元素多, 新的元素少,,少出掉多的元素
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
                    unmout(prevChild); // 老的元素里有,但是新列表里没有. 就删除掉这个元素
                }
                else {
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
                let anchor = lastIndex + 1 < c2.length ? c2[lastIndex + 1].el : null; // 如果最后一个索引+ 1还有值, 说明不是数组最后一位,后面还有人可以取值. 如果后面没值了,说明是最后一个.  可能就是dom的appendChild和insert有anchor的区别
                if (newIndextoOldMapIndex[i] === 0) { // 拿着新数组里的索引去老索引里找,有就是有可复用元素,没有就是不存在元素
                    // 这里if使用patch是因为不存在这个节点,而下面的else是已经存在节点,只是修改dom元素
                    patch(null, c2[lastIndex], container, anchor); // 如果是新增元素,就是使用patch创建一个元素,插入当前元素里
                }
                else {
                    // 这里可以进行性能优化 因为有一些节点不需要移动,到那时还是全部插入了一遍.
                    // 最长递增子序列,减少dom的插入操作
                    // 此处开始倒叙的插入.每一个孩子(这些孩子都是复用的) -- 直接插入是性能损耗大,需要最长递增子序列后 dom操作改到最少再操作
                    // 3-2-1-0 => 倒叙 
                    if (i !== queue[j]) { // 索引不同,说明没法优化直接插入.
                        hostInsert(lastChild.el, container, anchor); // 将列表倒叙的插入
                    }
                    else { // 相同的索引说明可以复用
                        j--; // 相当于当前元素直接操作,就把循环减少就行.  // 这里是个优化,标识元素不需要移动了
                    }
                }
                // hostInsert(c2[newIndextoOldMapIndex[i]],container,)
            }
        };
        let patchChildren = (n1, n2, el) => {
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
            if (currentShapeFlag & 8 /* TEXT_CHILDREN */) {
                // 1. 之前是数组
                if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                    unmoutChildren(c1);
                }
                // 4. 之前是文本,之后也是文本 => 走到这的原因是: 外层限定现在是文本,如果是数组也卸载掉了,所以这里肯定是之前和现在都是文本, 那么就替换文本内容.
                if (c1 !== c2) {
                    hostSetElementText(el, c2);
                }
            }
            else {
                // 现在这里面就都是数组了
                if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                    // 2.说明之前是数组,现在也是数组 ******
                    if (currentShapeFlag & 16 /* ARRAY_CHILDREN */) {
                        // 比对两个数组的差异
                        patchKeyedChildren(c1, c2, el);
                    }
                    else {
                        // 之前是数组, 现在不是数组-就是空文本 => 需要把之前的都干掉
                        unmoutChildren(c1);
                    }
                }
                else {
                    // 之前是文本,清空所有孩子
                    if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                        hostSetElementText(el, '');
                    }
                    // 之前是文本,现在是数组,挂载所有孩子
                    if (currentShapeFlag & 16 /* ARRAY_CHILDREN */) {
                        mountChildren(c2, el);
                    }
                }
            }
        };
        let patchElement = (n1, n2) => {
            // 1. 复用元素 2. 比较属性 3. 比较孩子
            let el = n2.el = n1.el; // diff算法,
            let oldProps = n1.props || {};
            let newProps = n2.props || {};
            patchProps(oldProps, newProps, el);
            // 比较孩子 => diff孩子 => 有很多情况 ,我们的diff算法是同级别比较. 就是一个树形结构. 就是A根下面有b和c   A1根下有b1和c1 A和A1比较,b,c和b1,c1比较
            patchChildren(n1, n2, el); // 用新得儿子n2和老的儿子n1 进行比对
        };
        let processElement = (n1, n2, container, anchor) => {
            if (n1 === null) {
                // 元素的初始化,因为首个元素是空
                mountElement(n2, container, anchor);
            }
            else {
                // 元素的diff算法 
                patchElement(n1, n2); // 更新两个元素之间的差异
            }
        };
        let processText = (n1, n2, container) => {
            if (n1 === null) {
                // 文本的初始化
                let textNode = hostCreateText(n2.children);
                n2.el = textNode;
                hostInsert(textNode, container);
            }
        };
        let unmout = (vnode) => {
            hostRemove(vnode.el);
        };
        let patch = (n1, n2, container, anchor = null) => {
            // 第一种: 两个元素完全没有关系
            if (n1 && !isSameVNodeType(n1, n2)) { // 是否相同节点,如果是相同节点走diff. 不是相同节点删除原来dom节点,并且把n1参数清空为null,
                unmout(n1);
                n1 = null; // 只要是null,就会走初始化流程
            }
            if (n1 === n2)
                return;
            let { ShapeFlag, type } = n2;
            switch (type) {
                case Text:
                    processText(n1, n2, container);
                    break;
                default:
                    if (ShapeFlag & 6 /* COMPONENT */) { // 组件需要处理
                        processComponent(n1, n2, container);
                    }
                    else if (ShapeFlag & 1 /* ELEMENT */) { // 如果当前类型是元素的话
                        processElement(n1, n2, container, anchor);
                    }
            }
            // switch (type) {
            //     case value:
            //         break;
            //     default:
            //         break;
            // }
        };
        let render = (vnode, container) => {
            // 后续还有更新 patch方法 包含初次渲染 和更新
            patch(null, vnode, container); // prevVnode(上次虚拟节点,没有就是初次渲染),node(本次渲染节点),container(容器)
        };
        return {
            createApp: createAppApi(render),
            render
        };
    }

    class ComputedRefImpl {
        constructor(getter, setter) {
            this.setter = setter;
            this._dirty = true; // 默认是脏值
            this.__v_isRef = true; // 表示是个ref对象,是ref就可以.value
            this.effect = new ReactiveEffect(getter, () => {
                // 稍后计算属性依赖的值,不要重新执行计算属性的effect,而是调用此函数.
                if (!this._dirty) {
                    this._dirty = true;
                    triggerEffects(this.dep);
                }
            }); // 创造一个计算属性,就是创造一个effect. 函数就使用getter
            // console.log(this);
        }
        get value() {
            /*
            computed的getter也要收集依赖
                需要确认几个点
                1. 是否在effect中取值
            */
            // 是否在effect中取值
            if (isTracking()) {
                trackEffects(this.dep || (this.dep = new Set()));
            }
            /*        console.log(Array.from(this.dep) );
                   let d1  = Array.from(this.dep);
                   let d2 = Array.from(d1[0].deps[0]);
                   console.log(d2);
                   console.log(d1[0] ,'-------',d2[0]);
                   console.log(d1[0] === d2[0]); */
            // computed的脏值判断,没修改就复用原有值
            if (this._dirty) {
                this._value = this.effect.run(); // 就是effect的run方法,返回了这个值
                this._dirty = false;
            }
            return this._value;
        }
        set value(newValue) {
            this.setter(newValue); // 修改计算属性的置, 就出发自己的set方法
        }
    }
    function computed(getterOrOptions) {
        let onlyGetter = isFunction(getterOrOptions);
        let getter;
        let setter;
        if (onlyGetter) { // 有可能只传入函数
            getter = onlyGetter;
            setter = () => { };
        }
        else { // 有可能传入一个对象,属性访问器的模式
            getter = getterOrOptions.get;
            setter = getterOrOptions.set;
        }
        return new ComputedRefImpl(getter, setter);
    }

    class RefImpl {
        constructor(_rawValue) {
            this._rawValue = _rawValue;
            this._value = toReactive(_rawValue); // 相当于 _rawValue是传入的,如果是普通值两个值是相同的,如果是对象,原值和_value就是不同的
        }
        get value() {
            if (isTracking()) {
                trackEffects(this.dep || (this.dep = new Set()));
            }
            return this._value;
        }
        set value(newValue) {
            if (this._rawValue !== newValue) {
                this._rawValue = newValue;
                this._value = toReactive(newValue);
                triggerEffects(this.dep);
            }
        }
    }
    function createRef(value) {
        return new RefImpl(value);
    }
    function ref(value) {
        return createRef(value);
    }

    function createVNode(type, props, children = null) {
        // 创建虚拟节点3元素 
        // 1. 创建的类型
        // 2. 节点的属性
        // 3. 孩子
        /*
         对象就是组件           {}
         字符串就是元素.        'div'
         不认识就是0            不知道的元素
          */
        let ShapeFlag = isObject(type) ? 6 /* COMPONENT */ : isString(type) ? 1 /* ELEMENT */ : 0;
        // 虚拟节点
        let vnode = {
            __v_isVnode: true,
            type,
            props,
            ShapeFlag,
            children,
            key: props && props.key,
            component: null,
            el: null, // 虚拟节点对应的真实节点
        };
        if (children) { // 如果有儿子,有两种情况 ['hello','zf'] / 'div'
            // 儿子分为几种类型, 如果是数组,类型就是数组儿子,如果是字符串,就是文本.
            // vnode就可以描述出来: 当前节点是一个什么节点,并且儿子是个什么节点. 
            // 稍后渲染虚拟节点的时候, 可以判断儿子是数组 就会循环渲染
            vnode.ShapeFlag = vnode.ShapeFlag | (isString(children) ? 8 /* TEXT_CHILDREN */ : 16 /* ARRAY_CHILDREN */); // 这个意思就是两个属性叠加在一起了, 
        }
        return vnode;
    }
    function isVNode(vnode) {
        return vnode && !!vnode.__v_isVnode;
    }

    function h(type, propsOrChildren, children) {
        /*
            多种写法:
            两个参数的
                1. h('div',{color:red}) 种类 + 属性 没孩子
                2. h('div',h('span'))   种类 + 孩子(h)   h方法返回对象
                3. h('div','hello')     种类 + 孩子(字符串)
                4. h('div',['hello','hello']) 种类 + 孩子(数组)
                
                除了第一种,好像其他的都会包裹成为第四种([孩子1,孩子2....])
            三个参数/超过三个参数
                1. h('div',{},'孩子')     种类 + 属性 + 孩子(字符串)
                2. h('div',{},['孩子'])   种类 + 属性 + 孩子(数组-多个)
                3. h('div',{},h('span'))  种类 + 属性 + 孩子(单个,h)
             
            最终只会留下两种类型
                1. h('div',{},'孩子')
                2. h('div',{},['孩子1','孩子2'])

                h('div',{},h('span')) => 也会变成第二种类型(最终留下的第二种)
            
        */
        let l = arguments.length;
        if (l === 2) {
            // 进入这里是2个参数;
            if (isObject(propsOrChildren) && !Array.isArray(propsOrChildren)) { // 进入这里面是种类1 和种类2
                if (isVNode(propsOrChildren.vnode)) { //  如果是虚拟节点,就要转成数组写法 
                    return createVNode(type, null, children); // h('div',h('span')) 创造虚拟节点,没有属性,孩子是children
                }
                return createVNode(type, propsOrChildren, null); // h('div',{color:red}) 不是数组,所以孩子处传递null
            }
            else {
                return createVNode(type, null, propsOrChildren); // 是类型3和类型4, 第三个参数传递propsOrChildren是因为第二个参数是孩子.而三个参数的时候就是第三个是孩子
            }
        }
        else { // 就是l >= 3的
            if (l > 3) { // 除了2后面的都做成孩子
                children = Array.prototype.slice.call(arguments, 2); // 从索引2开始,后面的都留存下来  (1,2,3,4,5,6,7) => [3,4,5,6,7]
            }
            else if (l === 3 && isVNode(children)) { // 如果孩子是一个虚拟节点,也用数组包裹,方便后面使用.
                children = [children];
            }
            return createVNode(type, propsOrChildren, children); // 最终调用这个方法,第三个参数是孩子,和l ===2不同是因为那边的孩子第二个参数就是孩子,所以传递第二个.
        }
    }

    const nodeOps = {
        insert: (child, parent, anchor = null) => {
            parent.insertBefore(child, anchor); // 如果没有anchor,就相当于appendChild方法
        },
        remove: child => {
            const parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        },
        createElement: tag => document.createElement(tag),
        createText: text => document.createTextNode(text),
        // 更新文本内容
        setElementText: (el, text) => el.textContent = text,
        // 设置文本内容
        setText: (node, text) => node.nodeValue = text,
        parentNode: node => node.parentNode,
        nextSibling: node => node.nextSibling,
        querySelector: selector => document.querySelector(selector)
    };
    // runtime-dom 提供 节点操作的api -> 传递给 runtime-core

    // 需要比对属性 diff算法    属性比对前后值
    function patchClass(el, value) {
        if (value == null) {
            el.removeAttribute('class');
        }
        else {
            el.className = value;
        }
    }
    function patchStyle(el, prev, next) {
        const style = el.style; // 操作的是样式
        // 最新的肯定要全部加到元素上
        for (let key in next) {
            style[key] = next[key];
        }
        // 新的没有 但是老的有这个属性, 将老的移除掉
        if (prev) {
            for (let key in prev) {
                if (next[key] == null) {
                    style[key] = null;
                }
            }
        }
    }
    function createInvoker(value) {
        const invoker = (e) => {
            invoker.value(e);
        };
        invoker.value = value; // 存储这个变量, 后续想换绑 可以直接更新value值
        return invoker;
    }
    function patchEvent(el, key, nextValue) {
        // vei  vue event invoker  缓存绑定的事件 
        const invokers = el._vei || (el._vei = {}); // 在元素上绑定一个自定义属性 用来记录绑定的事件
        let exisitingInvoker = invokers[key]; // 先看一下有没有绑定过这个事件
        if (exisitingInvoker && nextValue) { // 换绑逻辑
            exisitingInvoker.value = nextValue;
        }
        else {
            const name = key.slice(2).toLowerCase(); // eventName
            if (nextValue) {
                // ****看invokers和key都是什么****
                const invoker = invokers[key] = createInvoker(nextValue); // 返回一个引用
                el.addEventListener(name, invoker); // 正规的时间 onClick =(e)=>{}
            }
            else if (exisitingInvoker) {
                // 如果下一个值没有 需要删除
                el.removeEventListener(name, exisitingInvoker);
                invokers[key] = undefined; // 解绑了
            }
            // else{
            //     // 压根没有绑定过 事件就不需要删除了
            // }
        }
    }
    function patchAttr(el, key, value) {
        if (value == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
    }
    const patchProp = (el, key, prevValue, nextValue) => {
        if (key === 'class') { // 类名 
            patchClass(el, nextValue); // 
        }
        else if (key === 'style') { // 样式
            patchStyle(el, prevValue, nextValue);
        }
        else if (/^on[^a-z]/.test(key)) { // onXxx
            // 如果有事件 addEventListener  如果没事件 应该用removeListener
            patchEvent(el, key, nextValue);
            // 绑定一个 换帮了一个  在换绑一个
        }
        else {
            // 其他属性 setAttribute
            patchAttr(el, key, nextValue);
        }
    };

    // 需要函数我们的 dom 操作的api和属性操作的api,将这些api传入到我们的runtime-core中
    let renderOptions = Object.assign(nodeOps, {
        patchProp
    });
    // runtime-dom 在这层对浏览器的操作做了一些(就相当于dom是操作浏览器,而core里不用关心是小程序还是dom的操作了)
    const createApp = (component, rootProps = null) => {
        // 需要创建一个渲染器 
        let { createApp } = createRenderer(renderOptions);
        let app = createApp(component, rootProps);
        let { mount } = app;
        app.mount = function (container) {
            container = nodeOps.querySelector(container);
            container.innerHTML = '';
            mount(container);
        };
        return app;
    };

    exports.computed = computed;
    exports.createApp = createApp;
    exports.createRenderer = createRenderer;
    exports.effect = effect;
    exports.h = h;
    exports.reactive = reactive;
    exports.ref = ref;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
