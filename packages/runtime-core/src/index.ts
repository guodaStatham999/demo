import { createAppApi } from './apiCreateApp'

export * from '@vue/reactivity' // 导出这个模块中的所有代码




// runtime-core不依赖平台代码,因为平台代码都是传入的(比如runtime-dom)
export function createRenderer(renderOptions) {
    /*  
    拆包的逻辑 -> 有了这几个属性: 
        runtimeDom的所有APi: renderOptions
        有了要渲染的组件:     rootComponent
        有了组件的所有属性    rootProps
        有了最后的容器        container */

    let render = (vnode,container)=>{ // render就是给一个虚拟节点,渲染到哪里就可以了. 将虚拟节点转化为真实节点,渲染到容器中
        
    }
    return {
        createApp:createAppApi(render), // 创建一个CreateApp方法
        render
    }
}