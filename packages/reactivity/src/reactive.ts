import { track, trigger } from "./effect";
import { isObject } from "../../shared/src"



const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive'
}
function toReactive(value){
    return isObject(value)? reactive(value): value
}
let mutableHandler = {
    get(target, key, receiver) { // 取值: 去哪个对象,取哪个值,代理对象本身receiver. receiver就是proxy本身,就是new Proxy返回的proxy

        if (key === ReactiveFlags.IS_REACTIVE) {
            return true
        };

        track(target, key)

        let res = Reflect.get(target, key, receiver); // 等价于target[key] 只不过使用Reflect.get获取,会有取值是否成功


        // 每次取值都可以收集当前值在哪个effect中
        return res;
    },
    set(target, key, value, receiver) {
        let oldValue = target[key]; // 获取老值
        let res = Reflect.set(target, key, value, receiver); // Reflect.set会返回是否设置成功



        if (oldValue !== value) { // 老值和新值不同,才触发更新
            // 每次改值都可以出发effect更新
            trigger(target, key) // 找到对应的effect,让他去执行更新
        }
        return res
    }
}

// 弱引用对象,key必须是对象,如果key没有被引用,就会被自动销毁
let reactiveMap = new WeakMap()


// 只是区分是否浅的,是否仅读等四个参数来修改数据响应
// readonly shallowReadonly shallowReactive
// reactiveApi只针对对象才可以修改
function createReactiveObject(target: object) {
    // 解决对象是否二次代理的问题: 先默认认为这个target已经代理过的属性,
    if (target[ReactiveFlags.IS_REACTIVE]) { // 这个指是get的时候,触发取值逻辑,强制返回true,这个地方才是true 返回target的
        // 初始化的时候,target.[xxx] 就会访问这个属性,但是因为是对象还不是proxy就还没生成这个对象,访问就是undefined,所以不会访问. 而二次访问就有这个属性了
        return target
    }


    if (!isObject(target)) {
        return target
    }

    let existProxy = reactiveMap.get(target)// 如果有缓存,就使用上次结果
    if (existProxy) return existProxy


    let proxy = new Proxy(target, mutableHandler) // 当用户获取属性 或者修改属性的时候,我能劫持到 get/set
    reactiveMap.set(target, proxy)
    return proxy;
}

function reactive(target: object) {
    return createReactiveObject(target)
}




export {
    reactive,
    toReactive
}