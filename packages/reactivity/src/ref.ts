import { isTracking, trackEffects, triggerEffects } from './effect';
import { toReactive } from './reactive'



class RefImpl {
    public dep
    public __v_isRef
    public _value
    constructor(public _rawValue) { // 如果用户传入的是一个对象,需要转成响应式
        this._value = toReactive(_rawValue); // 相当于 _rawValue是传入的,如果是普通值两个值是相同的,如果是对象,原值和_value就是不同的
    }
    get value() {
        if (isTracking()) {
            trackEffects(this.dep || (this.dep = new Set()))
        }
        return this._value;
    }
    set value(newValue) {
        if (this._rawValue !== newValue) {
            this._rawValue = newValue;
            this._value = toReactive(newValue)
            triggerEffects(this.dep)
        }
    }
}

function createRef(value) {
    return new RefImpl(value)
}
function ref(value) {
    return createRef(value)
}



export {
    ref
}