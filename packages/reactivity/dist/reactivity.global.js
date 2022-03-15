var VueReactivity = (function (exports) {
    'use strict';

    const effectStack = []; // effect: 目的是保证effect可以存储正确的effect执行关系
    let activeEffect; // 当前激活的effect
    class ReactiveEffect {
        constructor(fn) {
            this.fn = fn;
            this.active = true; // 功能: 记录当前effect是否激活可用,默认激活状态 写法: 在当前类上 this.active = true
            this.deps = []; // effect依赖那些属性
            this.run();
        }
        run() {
            if (!this.active) { // 非激活状态会执行fn函数
                return this.fn();
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
            debugger;
            effectStack.push(activeEffect = this); // 初始化会调用run方法,this就是当前effect
            this.fn(); // 这个函数执行的时候,就会触发属性访问,然后就会连锁触发proxy.get方法. 这个时候get里就可以得到当前effect是谁(因为先做的effectStack.push操作).
        }
    }
    function effect(fn) {
        let _effect = new ReactiveEffect(fn);
        _effect.run(); // 默认让fn执行一次
    }

    function isObject(obj) {
        return typeof obj === 'object' && !Array.isArray(obj);
    }

    let mutableHandler = {
        get(target, key, receiver) {
            if (key === "__v_isReactive" /* IS_REACTIVE */) {
                console.log(key);
                debugger;
                return true;
            }
            console.log(receiver, '代理对象本身? 目标对象是target,但是receiver是什么');
            let res = Reflect.get(target, key, receiver); // 等价于target[key] 只不过使用Reflect.get获取,会有取值是否成功
            // 每次取值都可以收集当前值在哪个effect中
            return res;
        },
        set(target, key, value, receiver) {
            let res = Reflect.set(target, key, value, receiver); // Reflect.set会返回是否设置成功
            // 每次改值都可以出发effect更新
            return res;
        }
    };
    // 弱引用对象,key必须是对象,如果key没有被引用,就会被自动销毁
    let reactiveMap = new WeakMap();
    // 只是区分是否浅的,是否仅读等四个参数来修改数据响应
    // readonly shallowReadonly shallowReactive
    // reactiveApi只针对对象才可以修改
    function createReactiveObject(target) {
        // 解决对象是否二次代理的问题: 先默认认为这个target已经代理过的属性,
        if (target["__v_isReactive" /* IS_REACTIVE */]) { // 这个指是get的时候,触发取值逻辑,强制返回true,这个地方才是true 返回target的
            // 初始化的时候,target.[xxx] 就会访问这个属性,但是因为是对象还不是proxy就还没生成这个对象,访问就是undefined,所以不会访问. 而二次访问就有这个属性了
            return target;
        }
        if (!isObject(target)) {
            return target;
        }
        let existProxy = reactiveMap.get(target); // 如果有缓存,就使用上次结果
        if (existProxy)
            return existProxy;
        let proxy = new Proxy(target, mutableHandler); // 当用户获取属性 或者修改属性的时候,我能劫持到 get/set
        reactiveMap.set(target, proxy);
        return proxy;
    }
    function reactive(target) {
        return createReactiveObject(target);
    }

    exports.effect = effect;
    exports.reactive = reactive;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
