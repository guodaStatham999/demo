import { isObject } from "@vue/shared";
import { isVNode,createVNode } from './createVNode'

export function h(type, propsOrChildren, children) { // 第一个参数是标签名 第二个是属性或者孩子,因为有可能不传属性 第三个是孩子(也有可能不唯一是个数组)

    /* 
        多种写法:
        两个参数的
            1. h('div',{color:red}) 种类 + 属性 没孩子
            2. h('div',h('span'))   种类 + 孩子(h)   h方法返回对象
            3. h('div','hello')     种类 + 孩子(字符串)
            4. h('div',['hello','hello']) 种类 + 孩子(数组) 
            
            除了第一种,好像其他的都会包裹成为第四种([孩子1,孩子2....])
        三个参数/超过三个参数
            1. h('div',{},'孩子')     种类 + 属性 + 孩子(字符串)
            2. h('div',{},['孩子'])   种类 + 属性 + 孩子(数组-多个)
            3. h('div',{},h('span'))  种类 + 属性 + 孩子(单个,h)
         
        最终只会留下两种类型
            1. h('div',{},'孩子')
            2. h('div',{},['孩子1','孩子2']) 

            h('div',{},h('span')) => 也会变成第二种类型(最终留下的第二种)
        
    */

    let l = arguments.length;
    if (l === 2) { 
        // 进入这里是2个参数;
        
        if(isObject(propsOrChildren) && !Array.isArray(propsOrChildren)){ // 进入这里面是种类1 和种类2
            if(isVNode(propsOrChildren.vnode)){ //  如果是虚拟节点,就要转成数组写法 
                return  createVNode(type, null, children); // h('div',h('span')) 创造虚拟节点,没有属性,孩子是children
            }
            return createVNode(type,propsOrChildren,null); // h('div',{color:red}) 不是数组,所以孩子处传递null
        }else{
            return createVNode(type,null,propsOrChildren); // 是类型3和类型4, 第三个参数传递propsOrChildren是因为第二个参数是孩子.而三个参数的时候就是第三个是孩子
        }
    } else{ // 就是l >= 3的
        if(l > 3){ // 除了2后面的都做成孩子
            children =     Array.prototype.slice.call(arguments,2); // 从索引2开始,后面的都留存下来  (1,2,3,4,5,6,7) => [3,4,5,6,7]
            
        }else if(l===3 && isVNode(children)){ // 如果孩子是一个虚拟节点,也用数组包裹,方便后面使用.
            children = [children]
        }
        return createVNode(type,propsOrChildren,children); // 最终调用这个方法,第三个参数是孩子,和l ===2不同是因为那边的孩子第二个参数就是孩子,所以传递第二个.
    }

}