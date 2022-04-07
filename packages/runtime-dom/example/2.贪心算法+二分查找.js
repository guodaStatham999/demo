// http://www.javascriptpeixun.cn/course/3365/task/254238/show整整一集


// 2.3.8.9.6.7.12.22

// 递增: 2.3.8就是递增 2.3.9也是递增 2.8.6不是递增

// 1. 求最长递增子序列的长度

/* 
找更有潜力的数值
1. 直接看元素 如果比当前的末尾大,直接追加
2. 如果有比结尾小,那就找到最 靠近 他的,替换掉. (因为更有连续性)
 ***这个逻辑下,长度是对的***  而且最后一个永远是对的
*/

/* 
循环的时候 分为几种情况
 1. 默认就是结果递增的   值: 1 2 3 4 5 6 7  => 索引: 0 1 2 3 4 5 6  就直接结束
 2. 
*/


function getSequence(arr) {
    let len = arr.length; // 获取长度
    let result = [0]; // 这里放的是索引,0就是arr的第一个值 => 1
    let lastIndex; // 最后一个值的索引

    // 二分查找的三个指针
    let start;
    let end;
    let middle;

    // 1. 直接看元素 如果比当前的末尾大,直接追加
    for (let i = 0; i < len; i++) {
        let arrI = arr[i]; // 获取的是每一个值,但是这里命名为arrI感觉不符合. 而且结果也是值,并不是索引
        if (arrI !== 0) { // 如果是0就不记录了,因为这个是新增.不用考虑
            lastIndex = result[result.length - 1]; // 获取结果集中的最后一个
            if (arr[lastIndex] < arrI) { // 当前项和最后一项比较大小,就追加
                result.push(i);
                continue
            }
        }


        // 前面因为有个continue,所以只有在新入的项小于最后一项才会进入
        // 二分查找 替换元素
        start = 0; // 开始是从头开始-索引
        end = result.length - 1; // 结尾
        while (start < end) { // start == end就是停止条件
            middle = ((start + end) / 2) | 0; // 这个是中间的索引

            // arr是数组,result是索引的数组,从result里取出来的索引,也就是arr里找到指定的索引
            if(arr[result[middle]] < arrI){ // 找到序列中间的索引,通过索引,找对应的值
                start = middle + 1; // 也就是匹配到后,立刻把左边的指针挪到中间值的右侧
            } else{
                end = middle; // 修改右侧结束值的结果为中间值,也就是把右侧结束指针放到中间位置
            }
        }
        
        console.log(result[start] === middle);
        if( arrI  < arr[result[start]] ){ // 如果当前值比 查找出来的值小的话,就要替换
            result[start] = i; // result是记录索引的,i是当前索引. 重新修改
        } // 找到更有潜力的, 替换之前的(贪心算法)
        console.log(result);

    }


    // 2. 如果有比结尾小,那就找到最 靠近 他的,替换掉. (因为更有连续性) 这个是有问题,只是索引没问题和长度没问题>好像是,后面看结果
    // 2.1 找到比当前值大的数字替换 => 使用二分查找,不用整体轮训


}

getSequence([2, 3, 8, 9, 5]); // [0,1,2,3] => [0,1,4,3]
// getSequence([1, 2, 3, 4, 5, 6, 7, 0])