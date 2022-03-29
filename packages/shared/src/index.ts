function isObject(obj) {
    return typeof obj === 'object' && !Array.isArray(obj)
}
function isFunction(val) {
    return typeof val === 'function'
}
function isString(val) {
    return typeof val === 'string'
}

const enum ShapeFlags {
    ELEMENT = 1, // 元素
    FUNCTIONAL_COMPONENT = 1 << 1, // 1 函数式组件
    STATEFUL_COMPONENT = 1 << 2, // 4 普通组件
    TEXT_CHILDREN = 1 << 3, // 8 孩子是文本
    ARRAY_CHILDREN = 1 << 4, // 16 孩子是数组
    SLOTS_CHILDREN = 1 << 5, // 32 组件插槽
    TELEPORT = 1 << 6, // 64 TELEPORT组件
    SUSPENSE = 1 << 7, // 132 SUSPENSE组件
    COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT // 组件 位移 | & 是权限必备的操作
}

// 二进制是010101组成的,是每移动一位就成了另外一个样子  00001=> 就是00010
// | 的能力是: 100 | 10 只要是有1就是1  结果: 110
// & 的能力是: 100 & 10 必须是两个都是1 结果: 000 ,而用110 & 10 结果: 10 ,因为第二位的1是都有的,而100的1是只有一个.

let hasOwnProperty = Object.prototype.hasOwnProperty;
function hasOwn(value,key){
    return hasOwnProperty.call(value,key)
}

export {
    isObject,
    isFunction,
    isString,
    ShapeFlags,
    hasOwn
}