// 需要函数我们的 dom 操作的api和属性操作的api,将这些api传入到我们的runtime-core中
import { createRenderer } from '@vue/runtime-core';
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
let renderOptions = Object.assign(nodeOps, { // 渲染所生成的所有api.  使用Object.assign是因为patchProp是函数,给他一个名(patchProp),让他成为对象的一个key,value是函数
    patchProp
})


// runtime-dom 在这层对浏览器的操作做了一些(就相当于dom是操作浏览器,而core里不用关心是小程序还是dom的操作了)
export const createApp = (component, rootProps = null) => {
    // 需要创建一个渲染器 
    let { createApp } = createRenderer(renderOptions);

    let app = createApp(component, rootProps);
    let { mount } = app;
    app.mount = function (container) {
        container = nodeOps.querySelector(container);
        container.innerHTML = ''
        mount(container)
    }
    return app;
}

// 我们需要渲染页面你的时候, 需要节点操作的一系列方法

export * from '@vue/runtime-core'