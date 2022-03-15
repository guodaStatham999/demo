
const effectStack = []; // effect: 目的是保证effect可以存储正确的effect执行关系
let activeEffect; // 当前激活的effect

class ReactiveEffect { // 让effect记录他依赖了那些属性,同样也需要属性记录用了那些effect
    active = true // 功能: 记录当前effect是否激活可用,默认激活状态 写法: 在当前类上 this.active = true
    deps = [] // effect依赖那些属性
    constructor(public fn) { // 写法: public fn => this.fn = fn
        this.run()
    }
    run() { // 调用run的时候,会让fn执行一次. effect依赖了很多属性,任何一个属性修改,都要触发页面更新
        if (!this.active) { // 非激活状态会执行fn函数
            return this.fn()
        }


        // 建立属性和effect之间的关系
        /* 
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
        console.log(333);
        console.log(effectStack);
        console.log(activeEffect);
        effectStack.push(activeEffect = this); // 初始化会调用run方法,this就是当前effect
         this.fn();// 这个函数执行的时候,就会触发属性访问,然后就会连锁触发proxy.get方法. 这个时候get里就可以得到当前effect是谁(因为先做的effectStack.push操作).

    }

}


function effect(fn) {
    let _effect = new ReactiveEffect(fn)
    _effect.run() // 默认让fn执行一次
}

export {
    effect
}