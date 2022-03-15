function isObject(obj){
    return typeof obj === 'object' && !Array.isArray(obj)
}
export  {
    isObject
}