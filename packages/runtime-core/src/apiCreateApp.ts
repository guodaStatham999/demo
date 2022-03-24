import { isObject, ShapeFlags, isString } from "@vue/shared";

export function createVNode(type, props, children = null) {
    // 创建虚拟节点3元素 
    // 1. 创建的类型
    // 2. 节点的属性
    // 3. 孩子

    /*  
     对象就是组件           {}
     字符串就是元素.        'div'
     不认识就是0            不知道的元素
      */
    let ShapeFlag = isObject(type) ? ShapeFlags.COMPONENT : isString(type) ? ShapeFlags.ELEMENT : 0
    console.log(ShapeFlag);
    
    // 虚拟节点
    let vnode = { // 跨平台,因为任何平台都可以从这个虚拟节点上取值
        __v_isVnode: true,
        type,
        props,
        ShapeFlag, // 标识一下是什么类型
        children,
        key: props && props.key, // 用来做diff算法的
        component: null, // 如果是组件的虚拟节点,要保存组件的实例
        el: null, // 虚拟节点对应的真实节点

    }

    if (children) { // 如果有儿子,有两种情况 ['hello','zf'] / 'div'
        // 儿子分为几种类型, 如果是数组,类型就是数组儿子,如果是字符串,就是文本.


        // vnode就可以描述出来: 当前节点是一个什么节点,并且儿子是个什么节点. 
        // 稍后渲染虚拟节点的时候, 可以判断儿子是数组 就会循环渲染
        vnode.ShapeFlag = vnode.ShapeFlag | (isString(children) ? ShapeFlags.TEXT_CHILDREN : ShapeFlags.ARRAY_CHILDREN) // 这个意思就是两个属性叠加在一起了, 

    }
    console.log(vnode,'vnode');
    


    return vnode

}

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