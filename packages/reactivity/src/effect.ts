
const effectStack = []; // effect: 目的是保证effect可以存储正确的effect执行关系
let activeEffect; // 当前激活的effect

function cleanUpEffect(effect){ // 总结: 就是把属性身上记载的effect删除,只是没去再从targetMap里寻找,而是在track记录的时候,存储在effect身上.这个时候取出来,把空间地址里的内容调用delete(set的方法),删除掉.就可以了.      所以不能把属性(name/age)身上的 deps = [],这样只是修改空间地址,而不是删除真正空间里的内容
    let {deps} = effect;
    for(let dep of deps){

        dep.delete(effect) // 老师解释: 让属性对应的effect移除掉, 就不会触发这个effect从新执行了.
        // 我的想法: 就是把当前的deps里的每个set里,删除this(effect). 
        // 解释: 每个dep就是set
        // 后面再理解: deps就是属性对应的set,删除掉属性里的set,以后再次调用属性,就不会触发对应的effect执行(因为已经删除了)
    }
}

 class ReactiveEffect { // 让effect记录他依赖了那些属性,同样也需要属性记录用了那些effect
    active = true // 功能: 记录当前effect是否激活可用,默认激活状态 写法: 在当前类上 this.active = true
    deps = [] // effect依赖那些属性
    constructor(public fn,public schduler?) { // 写法: public fn => this.fn = fn
        this.run()
    }
    run() { // 调用run的时候,会让fn执行一次. effect依赖了很多属性,任何一个属性修改,都要触发页面更新
        if (!this.active) { // 非激活状态会执行fn函数
            return this.fn()
        }


        /* 
        建立属性和effect之间的关系
        伪代码: 代码描述语言,方便被不同语言开发者所理解.
        effect1(()=>{
            state.name
            effect2(()=>{
                state.age
            })
            state.c
        })
        1. 外层effect1会收集name,age两个属性
        2. 栈形结构执行完name,就会执行effect2. 这个时候activeEffect就会是effect2
        3. 如果是state.c的话,就会使用effect2的c,就会有问题

        解决办法: 使用栈结构-一个数组[e1,e2]: 
            1. 取值永远最后一个栈来获取
            2. 执行e1的过程中,碰到了e2,就在栈的最后一位加入e2.
            3. 等到e2结束,就把栈的最后一位删除. 这个时候最后一位就又变回e1了 



        activeEffect = effect1 ,代码执行. 
        */

        try {
            if (!effectStack.includes(this)) { // 屏蔽同一个effect的执行\

                effectStack.push(activeEffect = this); // 初始化会调用run方法,this就是当前effect
                
                // 为了计算属性-添加的return
                return this.fn();// 这个函数执行的时候,就会触发属性访问,然后就会连锁触发proxy.get方法. 这个时候get里就可以得到当前effect是谁(因为先做的effectStack.push操作).
            }


        } finally {
            // 等到函数执行完毕后,就把栈中最后一项返回
            effectStack.pop(); // 最后一项删除掉,因为前面逻辑已经删除了
            activeEffect = effectStack[effectStack.length - 1]; // 最后一项最为选中项
        }



    }

    // 可以让effect
    stop(){ // 组件销毁的时候,就要把响应式停止.
        // console.log(this,'stop');
        // 让dep里的effect删除掉,就可以了
        // effect.deps和属性没有关系
        if (this.active) { // 非激活状态不会执行
            cleanUpEffect(this) // 就是把当前收集的effect清理掉   再理解: 是把当前effect里记录的effect删除掉


            this.active = false
        }


    }
}


function effect(fn) {
    let _effect = new ReactiveEffect(fn)
    _effect.run() // 默认让fn执行一次

    let runner = _effect.run.bind(_effect); // 需求: effect返回的函数任何时候执行,就会立刻从新渲染effect函数. 处理: 将effect的run方法返回,并且绑定this. 

    runner.effect = _effect// 使用一个属性存储实例,就可以直接使用实例上的原形方法.
    return runner
}



function isTracking() {
    return activeEffect !== undefined
}
let targetMap = new WeakMap()
// 收集effect
function track(target, key) {
    /* 
    问题: 每次调用get,就是获取属性. 就可以得到target和key. 答案: 当时取值的this就是当时的effect,他就是依赖当前的effect
    数据格式:
    effect1(()=>{ // 只要访问属性的时候,这个时候记录当前的effect.
        state.name
        effect2(()=>{
            state.age
        })
        state.c
    })
    */
    // console.log(target, key, activeEffect);

    /* 
    概念: 一个属性对应多个effect,一个effect依赖多个属性 => 多对多的关系
    数据格式:  {  使用weakMap,对象做参数,里面属性还是个对象的参数
                    对象: { 
                        某个属性: [ effect1, effect2 ]
                    } 
               }
    */
    if (!isTracking()) { // 需要是在effect里执行的target.xxx字段,才会有acctiveEffect,才是在effect里面操作或者修改值,这种才要收集.其他的选择字段并不需要. 就要return掉
        return // 双重取反 => 只要activeEffect是undefined就return
    }
    let depsMap = targetMap.get(target); // targetMap里面是否存储当前对象
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
        depsMap.set(key, (dep = new Set())) // {对象:{属性:set[]}}
    }

    trackEffects(dep)


}

function trigger(target,key){
    let depsMap =  targetMap.get(target)
    if(!depsMap)return; // 说明修改的属性根本没有依赖任何的effect

    let deps = []; // 存储的是[set,set]=>多个set
    if(key !==undefined){
        let set= depsMap.get(key)
        deps.push(set)
    }
    let effects = []
    for(let dep of deps){
        effects.push(...dep) // 
    }
    triggerEffects(effects)

}

function triggerEffects(dep){
    // 循环dep,让每个dep执行.
    for(let effect of dep){ // 把每个effect取出
        if(effect !== activeEffect){// 如果当前effect执行和要执行的effect是同一个,就不执行了,防止循环
            if(effect.schduler){ // 如果有schduler,就走这个逻辑
                return effect.schduler()
            }
            effect.run() // 执行effect,重新渲染数据
        }
    }
}

function trackEffects(dep){
    let shouldTrack = !dep.has(activeEffect)
    if (shouldTrack) { // 没有当前actvieEffect,就添加上
        dep.add(activeEffect); //set.add方法 => 把属性记录在实例的dep里,也就是说本身属性依赖的effect用一个set存储
        
        activeEffect.deps.push(dep); // 当前effect记录了最里层set,set里装的是 [effect],不太明白这个地方??  ---再理解: 其实就是把当前的effect.deps里记录了属性记录的所有set[effect],等到用的时候就知道是哪个set[effect]了  --------最后执行的时候,还是拓展到一个数组里,循环执行.
    }
}

export {
    effect,
    track,
    trigger,
    ReactiveEffect,
    isTracking,
    trackEffects,
    triggerEffects
}