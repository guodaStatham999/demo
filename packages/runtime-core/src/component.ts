import { hasOwn, isFunction, isObject } from '@vue/shared';
import { reactive } from 'packages/reactivity/src/reactive';
import { emit } from 'process';

export function createComponentInstance(vnode) {
    let type = vnode.type;
    const instance = {
        vnode, // 实例对应的虚拟节点
        type, // 组件对象,用户传入的.
        subTree: null, // 组件渲染的内容   vue3中组件的vnode 就叫vnode  组件渲染的结果 subTree(render方法返回的虚拟节点)
        ctx: {}, // 组件上下文
        props: {}, // 组件属性
        attrs: {}, // 除了props中的属性 
        slots: {}, // 组件的插槽
        setupState: {}, // setup返回的状态
        propsOptions: type.props, // 属性选项
        proxy: null, // 实例的代理对象
        render: null, // 组件的渲染函数
        emit: null, // 事件触发
        exposed: {}, // 暴露的方法
        isMounted: false // 是否挂载完成
    }

    instance.ctx = { _: instance }; // 后续对他做一层代理

    return instance;
}

export function initProps(instance, rawProps) {
    let props = {};
    let attrs = {};
    // 需要根据用户是否使用过这个属性,给他们命名.用过就是props,没用过就是attrs.
    let options = Object.keys(instance.propsOptions); // 就是用户当前组件上使用的props里的内容. 如果没有就是$attrs的内容.  
    if (rawProps) {
        for (let key in rawProps) {
            let value = rawProps[key];
            if (options.includes(key)) {
                props[key] = value
            } else {
                attrs[key] = value
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
        expose: (exposed) => { // 传入就有,没传入默认是空.   官网有demo: 看下来就是传入的值,可以直接使用.
            return instance.exposed = exposed || {}
        }
    }
}

let PbulicInstanceProxyHandlers = {
    // 这个代理的意义: 通过proxy代理,可以在访问对象的时候,直接取值setupState(以前的data)和props. 且有先后顺序
    get({ _: instance }, key) { // 解构出来_ ,重命名为instance
        // get(target,key){ // 这是一开始写的,但是解构的话减少赋值操作
        let { setupState, props } = instance;
        if (hasOwn(setupState, key)) {
            return setupState[key]
        } else if (hasOwn(props, key)) {
            return props[key]
        } else {
            // $nextTick....
        }

    },
    set({ _: instance }, key, value) {
        let { setupState, props } = instance; // props不能修改
        if (hasOwn(setupState, key)) {
            setupState[key] = value
        } else if (hasOwn(props, key)) {
            console.warn('Props are readonly');
            
            return false
        } else {
            // $nextTick....
        }

        return true;
    }
}

export function setupStateFullComponent(instance) {

    // setup函数在实例的type里render函数
    let Component = instance.type;
    let { setup } = Component;

    // 这个proxy既能拿属性data,又能拿props,就类似vue2的this 
    // instance.ctx是写法是: instance.ctx = { _ : 一个instance }
    instance.proxy = new Proxy(instance.ctx, PbulicInstanceProxyHandlers) // 处理代理上下文的函数

    // console.log(instance.proxy.a,'2222')
    if (setup) {
        /*  
        setup(第一个参数就是props,第二个参数就是attrs,emit,expose,slots集合) */
        let setupContext = createSetupContext(instance)
        let setupResult = setup(instance.props, setupContext)
        if (isFunction(setupResult)) {
            instance.render = setupResult; // 如果setup的是函数,他就是render函数
        } else if (isObject(setupResult)) {
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

export function setupComponent(instance) {
    let { attrs, props, children } = instance.vnode;
    // 组件的props做初始化, attrs也要初始化
    initProps(instance, props) // 将两个属性 props和attrs分别开来


    // 插槽的初始化 ,2022年3月28日10:38:39,说 后面做
    // initSlots(instance,children)....

    setupStateFullComponent(instance); // 这个方法的目的就是调用setup函数,得到用户的返回值.扩充setup和render函数 启动带状态的组件
}