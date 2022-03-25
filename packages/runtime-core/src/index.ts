import { reactive } from '@vue/reactivity';
import { ShapeFlags } from '@vue/shared';
import { createAppApi } from './apiCreateApp'

export * from '@vue/reactivity' // 导出这个模块中的所有代码


export  function createComponentInstance (vnode){
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
            render:null, // 组件的渲染函数
            emit: null, // 事件触发
            exposed:{}, // 暴露的方法
            isMounted: false // 是否挂载完成
        }

        instance.ctx = { _:instance }; // 后续对他做一层代理
        
        return instance;
}

export function initProps(instance,rawProps){
    let props = {};
    let attrs = {};
    // 需要根据用户是否使用过这个属性,给他们命名.用过就是props,没用过就是attrs.
    let options = Object.keys(instance.propsOptions); // 就是用户当前组件上使用的props里的内容. 如果没有就是$attrs的内容.  
    if(rawProps){
        for(let key in rawProps){
           let value = rawProps[key];
           if(options.includes(key)){
               props[key] = value
           }else{
               attrs[key] = value
           }
        }
    }
    instance.props = reactive(props); // props是响应式
    instance.attrs = (attrs); // attrs是非响应式的
}

export function setupComponent(instance){
    let {attrs,props,children } = instance.vnode;
    // 组件的props做初始化, attrs也要初始化
    initProps(instance,props) // 将两个属性 props和attrs分别开来
    console.log(instance,'000');
    debugger
    
}

// runtime-core不依赖平台代码,因为平台代码都是传入的(比如runtime-dom)
export function createRenderer(renderOptions) {
    /*  
    拆包的逻辑 -> 有了这几个属性: 
        runtimeDom的所有APi: renderOptions
        有了要渲染的组件:     rootComponent
        有了组件的所有属性    rootProps
        有了最后的容器        container */


    let mountComponent = (initialVnode,container)=>{
        console.log(initialVnode,container,'***');

        // 挂载组件分3步骤
        // 1. 我们给组件创造一个组件的实例(一个对象,有n多空属性)
        let instance =initialVnode.component =  createComponentInstance(initialVnode); // 创建的是实例,会给到虚拟节点的组件上,然后再给到当前这个变量instance
        // 2. 需要给组件的实例做赋值操作
        setupComponent(instance); // 给实例赋予属性
        // 3. 

    }

    let processComponent = (n1,n2,container)=>{
        if(n1 === null){
            // 组件的初始化,因为首个元素是空
            mountComponent(n2,container)
        }else{
            // 组件的更新
        }
    }

    let patch = (n1,n2,container)=>{
        if(n1===n2)return;
        let {ShapeFlag } = n2;
        if(ShapeFlag & ShapeFlags.COMPONENT){ // 组件需要处理
            processComponent(n1,n2,container)
        }
    }

    let render = (vnode,container)=>{ // render就是给一个虚拟节点,渲染到哪里就可以了. 将虚拟节点转化为真实节点,渲染到容器中
        

        // 后续还有更新 patch方法 包含初次渲染 和更新
        patch(null,vnode,container) // prevVnode(上次虚拟节点,没有就是初次渲染),node(本次渲染节点),container(容器)
    }
    return {
        createApp:createAppApi(render), // 创建一个CreateApp方法
        render
    }
}