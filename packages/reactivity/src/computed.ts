import { isFunction } from "@vue/shared";
import { ReactiveEffect, isTracking, trackEffects,triggerEffects } from './effect'


class ComputedRefImpl {
    public dep; // 相当于在类型上添加dep = undefined
    public _dirty = true; // 默认是脏值
    public __v_isRef = true; // 表示是个ref对象,是ref就可以.value
    public effect; // 计算属性依赖于effect
    public _value
    constructor(getter, public setter) {
        this.effect = new ReactiveEffect(getter,()=>{
            // 稍后计算属性依赖的值,不要重新执行计算属性的effect,而是调用此函数.
            if(!this._dirty){
                this._dirty = true;
                triggerEffects(this.dep)
            }

        })  // 创造一个计算属性,就是创造一个effect. 函数就使用getter
        // console.log(this);
        
    }

    get value() { // 取值的时候,就会获取这个函数返回的值
        /* 
        computed的getter也要收集依赖
            需要确认几个点
            1. 是否在effect中取值
        */

        // 是否在effect中取值
        if(isTracking()){
            trackEffects(this.dep || (this.dep = new Set()))
        }
 /*        console.log(Array.from(this.dep) );
        let d1  = Array.from(this.dep);
        let d2 = Array.from(d1[0].deps[0]);
        console.log(d2);
        console.log(d1[0] ,'-------',d2[0]);
        console.log(d1[0] === d2[0]); */
        
        // computed的脏值判断,没修改就复用原有值
        if (this._dirty) {
            this._value = this.effect.run() // 就是effect的run方法,返回了这个值
            this._dirty = false;
        }
        return this._value


    }
    set value(newValue) { // 设置值会走这个函数,设置的值传入到setter函数就可以了.
        this.setter(newValue) // 修改计算属性的置, 就出发自己的set方法
    }
}

function computed(getterOrOptions) {
    let onlyGetter = isFunction(getterOrOptions);

    let getter;
    let setter;
    if (onlyGetter) { // 有可能只传入函数
        getter = onlyGetter;
        setter = () => { }
    } else { // 有可能传入一个对象,属性访问器的模式
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;

    }


    return new ComputedRefImpl(getter, setter)
}










export {
    computed
}