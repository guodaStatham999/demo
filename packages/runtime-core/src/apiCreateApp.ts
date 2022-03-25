import { createVNode } from "./createVnode";



function createAppApi(render) {
    return (rootComponent, rootProps) => {
        
        let isMounted = false; // 是否挂载完成

        let app = {
            mount(container) {
                /* 挂载的核心: 
                    1. 就是根据组件传入的对象,创造一个组件的虚拟节点
                    2. 在将这个虚拟节点渲染到容器中. 
                */

                // 1. 创建组件的虚拟节点
                let vnode = createVNode(rootComponent, rootProps); // h函数很像,给一个内容,创建一个虚拟节点
                render(vnode, container)
                if (!isMounted) {
                    isMounted = true;
                }


            },
        }
        return app
    }
}


export {
    createAppApi
}