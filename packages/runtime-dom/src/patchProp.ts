

// 需要比对属性 diff算法    属性比对前后值
function patchClass(el, value) {
    if (value == null) {
        el.removeAttribute('class');
    } else {
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
    const invoker = (e) => { // 每次事件触发调用的都是invoker 
        invoker.value(e)
    }
    invoker.value = value; // 存储这个变量, 后续想换绑 可以直接更新value值
    return invoker
}
function patchEvent(el, key, nextValue) {
    // vei  vue event invoker  缓存绑定的事件 
    const invokers = el._vei || (el._vei = {}); // 在元素上绑定一个自定义属性 用来记录绑定的事件
    let exisitingInvoker = invokers[key]; // 先看一下有没有绑定过这个事件
    if (exisitingInvoker && nextValue) { // 换绑逻辑
        exisitingInvoker.value = nextValue
    } else {
        const name = key.slice(2).toLowerCase(); // eventName
        if (nextValue) {
             // ****看invokers和key都是什么****
            const invoker = invokers[key] = createInvoker(nextValue); // 返回一个引用
            el.addEventListener(name, invoker);  // 正规的时间 onClick =(e)=>{}
        } else if (exisitingInvoker) {
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
        el.removeAttribute(key)
    } else {
        el.setAttribute(key, value)
    }
}
export const patchProp = (el, key, prevValue, nextValue) => {
    if (key === 'class') { // 类名 
        patchClass(el, nextValue); // 
    } else if (key === 'style') { // 样式
        patchStyle(el, prevValue, nextValue);
    } else if (/^on[^a-z]/.test(key)) { // onXxx
        // 如果有事件 addEventListener  如果没事件 应该用removeListener
        patchEvent(el, key, nextValue);
        // 绑定一个 换帮了一个  在换绑一个
    } else {
        // 其他属性 setAttribute
        patchAttr(el, key, nextValue);
    }
}