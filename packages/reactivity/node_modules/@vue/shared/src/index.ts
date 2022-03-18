function isObject(obj){
    return typeof obj === 'object' && !Array.isArray(obj)
}
function isFunction(val){
    return typeof val === 'function' 
}

export  {
    isObject,
    isFunction
}