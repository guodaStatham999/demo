export const nodeOps = {
    insert: (child, parent, anchor = null) => { // 插入有追加的功能
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
}


// runtime-dom 提供 节点操作的api -> 传递给 runtime-core 