# meteo-master

## Chrome浏览器GPU加速和WebGL支持开启方法记录
- 显卡不算烂的情况下：在Chrome的高级设置里开启“硬件加速”即可。
- 显卡比较烂的情况下：因为Chrome内置了一套显卡黑名单，如果你的显卡太烂，WebGL就会被默认禁用，因此需要强制开启。强制开启的方法是：首先要和上一点一样先开启“硬件加速”，然后在地址栏输入"chrome://flags"并回车打开Chrome的实验功能，启用Override software rendering list 选项，然后重启Chrome。

## canvas2D图片/纹理图片的坐标系和像素
```
比如现在有一张长度*宽度==2像素*2像素的图片
```
- 首先需要知道canvas2D图片/纹理图片是怎么生成的？
    - 1个像素对应一个单位像素区域。即对应0-1这条线段，而并不是指1个点。所以“`长度*宽度==2像素*2像素的图片`”指的是2个单位像素区域*2个单位像素区域的图片，即0-1，1-2两个线段的值
    - 这张图片所画的范围是[0,2)，即大于等于0，且小于2（注意：并不是小于等于2）

- 在设置/取出canvas2D图片/纹理图片某点颜色值时
    - 如果要给点（0，0）设置颜色，那么其实是给（0，0）、（1，0）、（1，1）、（0，1）四个点所围成的区域内填充颜色；
    以此类推，如果要给点（1，0）设置颜色，那么就是给（1，0）、（2，0）、（2，1）、（1，1）四个点所围成的区域内填充颜色；
    这也说明了为什么（1-2）中说“图片所画的范围是[0,2)”了，因为点（2，0）的颜色值是（2，0）、（3，0）、（3，1）、（2，1）四个点所围成的区域内填充的颜色，已经是横向第三个像素的区域了，而这个区域已经超出图片的范围了（图片是2*2像素的）
    - 如果要取点（0，0）的颜色，那么其实是取的（0，0）、（1，0）、（1，1）、（0，1）四个点所围成的区域内填充的颜色；
    以此类推，如果要取点（1，0）的颜色，那么就是取（1，0）、（2，0）、（2，1）、（1，1）四个点所围成的区域内填充的颜色；
    如果要取点（2，0）的颜色，那么就是取（2，0）、（3，0）、（3，1）、（2，1）四个点所围成的区域内填充的颜色，这时需要分情况讨论取出的颜色值到底是多少？
        - 如果是从canvas2D图片中取点（2，0）的颜色，因为这个点是第三个像素的区域，已经超出[0,2)的范围了，所以取出的值是（0，0，0，0），也就是并不存在这个值，所以全是0；
        - 如果是从纹理图片中取点（2，0）（纹理坐标为（1，0））的颜色，则要看在创建纹理图片时通过gl.texParameteri()指定了哪些参数;
            比如用gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)设置图片横向使用平铺式的重复原理，那么取出的值就是点（0，0）（纹理坐标为（0，0））的颜色值；具体分析看下一条！
            
- canvas2D图片像素、纹理图片像素（纹素）、纹理坐标之间对应的关系 
```
比如现在有一张长度*宽度==5像素*1像素的canvas2D图片，则沿x轴方向有如下规律（y轴规律一样，只是还需要注意canvas2D图片与纹理图片的y轴正方向是否相同的问题）：
```

|canvas2D图片：第几个像素|第1个像素|第2个像素|第3个像素|第4个像素|第5个像素|
|:-------------:|:-------------:|:-------------:|:-------------:|:-------------:|:-------------:|
|canvas2D图片：像素坐标|0|1|2|3|4|
|canvas2D图片：像素区域|[0,1)|[1,2)|[2,3)|[3,4)|[4,5)|
|纹理图片：canvas2D图片每个像素映射到纹理图片的纹素坐标|0.1|0.3|0.5|0.7|0.9|
|纹理图片：canvas2D图片每个像素映射到纹理图片的纹素区域|[0.0,0.2)|[0.2,0.4)|[0.4,0.6)|[0.6,0.8)|[0.8,1.0)|
|画布：如果要把纹理图片完全铺满整个屏幕，则纹理图片每个纹素映射到：屏幕的纹理坐标（纹理坐标系上的坐标）|0.1|0.3|0.5|0.7|0.9|
|画布：如果要把纹理图片完全铺满整个屏幕，则纹理图片每个纹素映射到：屏幕的像素区域（沿x轴正方向离屏幕纹理坐标（上一行表格的值）最近的一个屏幕像素（考虑纹理图片放大缩小））||||||
```
那么屏幕上其余的纹理坐标/像素区域要怎么填充呢，那就要看纹理图像映射到画布上的具体方式，即在绑定纹理对象时设置的什么参数了（gl.texParameteri()方法设置的）
    - 放大方法（gl.TEXTURE_MAG_FILTER）：这个参数表示，当纹理的绘制范围比纹理图片本身更大时，如何获取纹素颜色。
        比如说，
        从图形几何角度来讲，你将16×16的纹理图像映射到32×32像素的空间里时，纹理的尺寸就变成了原始的两倍。WebGL需要填充由于放大而造成的像素间的空隙，该参数就表示填充这些空隙的具体方法。
        从解析几何角度来讲，我有x=0.0，0.2，0.4，0.6的像素值，但这些都是端点值，并没有确定一条曲线的像素值表达式。所以如果要x=0.05的像素值呢？？？这时就没法确定了，因为只有几个端点没法确定怎么把这几个端点连成一条曲线，这时就得设置参数了，即gl.TEXTURE_MAG_FILTER的参数
    - 缩小方法（gl.TEXTURE_MIN_FILTER）：这个参数表示，当纹理的绘制范围比纹理本 身更小时，如何获取纹素颜色。
        比如说，你将32×32的纹理图像映射到16×16像素的空间里，纹理的尺寸就只有原始的半。为了将纹理缩小，WebGL需要剔除纹理图像中的部分像素，该参数就表示具体的剔除像素的方法。
    - 水平填充方法（gl.TEXTURE_WRAP_S）：这个参数表示，如何对纹理图像左侧或右侧的区域进行填充。
    - 垂直填充方法（gl.TEXTURE_WRAP_T）：这个参数表示，如何对纹理图像上方和下方的区域进行填充。
举个例子：要把这个5像素*1像素的纹理图片映射到10像素*1像素的屏幕上，那么图片的第一个像素区域对应屏幕的第一个像素区域，图片的第二个像素区域对应屏幕的第三个像素区域，那么屏幕的第二个像素区域要填充什么颜色呢？
这时假设gl.TEXTURE_MAG_FILTER设的是gl.LINEAR，那么就是图片的第一个像素区域（屏幕的第一个像素区域）的颜色和图片的第二个像素区域（屏幕的第三个像素区域）的颜色经过线性插值后的颜色
~~**具体看《WebGL编程指南》第168页**~~
```
```
从表格中还能看出，
- 每个像素对应的纹理长度=纹理图片长度/像素个数=1.0/5.0=0.2
- canvas2D图片像素区域与纹理图片纹素区域是等比例相同的
- canvas2D图片“像素坐标”位于像素区域左边界点，纹理图片“纹素坐标”位于纹素区域中心点：简要概括就是，“像素坐标在左边界点，纹素坐标在中心点”
- 注意区分，像素坐标、纹素坐标、纹理坐标的区别。纹素坐标全是纹理坐标，而并不是所有纹理坐标都是纹素坐标
``` 
- 总结：数据维度值和纹理坐标之间的换算关系
```
canvas2D图片==>原始纹理图片==>新的纹理图片
长度*宽度有[m]*[n]个维度值要存到canvas2D图片中，其中坐标范围：m∈[a,b)，间隔为c；n∈[d,e)，间隔为f.
    <==> (b-a)/c==m，(e-d)/f==n
canvas2D图片A：
    <==> canvas2D图片大小=[m像素]*[n像素]
    <==> canvas2D图片的canvas像素坐标范围[0,m)*[0,n)
    <==> canvas2D图片中每个像素的区域大小=[1]*[1]
原始纹理图片B：
    <==> 纹理图片大小=[m像素]*[n像素]
    <==> 纹理图片的纹素坐标范围[0.0,1.0)*[0.0,1.0)
    <==> 纹理图片中每个纹素的区域大小=[1.0/m]*[1.0/n]
新的纹理图片B1：
    <==> 纹理图像映射到图形上的具体方式：
         1）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER | gl.TEXTURE_MAG_FILTER,?)：如何解决WebGL需要填充由于纹理B放大而造成的像素间的空隙，由于纹理B缩小剔除纹理图像中的部分像素
           a）gl.LINEAR：将原始纹理图片B按照“以B中各个纹素坐标（纹素区域中心点）为圆心向外扩展，与B周围（上下左右）的纹素坐标（纹素区域中心点）的纹素值做相应换算，进行双线性插值”，得到一张新的“渐变的纹理图片”B1。
           b）gl.NEAREST：将原始纹理图片B按照“以B中各个纹素坐标（纹素区域中心点）为圆心向外扩展，使其余纹理坐标的像素值与离它最近的纹素坐标的纹素值相同”，得到一张新的“取最近纹素坐标纹素值的纹理图片”B1。
         2）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S | TEXTURE_WRAP_T, gl.LINEAR,?)：如何对纹理图像B左侧或右侧、上方和下方的区域进行填充
           a）gl.REPEAT：平铺式的重复纹理，即B1纹理坐标(x1,y1)的像素值为B1中(x1%1.0,y1%1.0)的像素值，具体还得考虑1）是设的什么值
           b）gl.MIRRORED:镜像对称式的重复纹理，即B1纹理坐标(x1,y1)的像素值为B1中(x1%1.0,y1%1.0)、(1.0-x1%1.0,y1%1.0)、(x1%1.0,1.0-y1%1.0)、(1.0-x1%1.0,1.0-y1%1.0)四个坐标其中一个的像素值，具体还得考虑1）是设的什么值
           c）gl.CLAMP_TO_EDGE：使用纹理图像边缘值，即B1纹理坐标(x1,y1)的像素值为离它最近的在B1区间范围[0.0,1.0)*[0.0,1.0)内的纹理坐标的像素值，具体还得考虑1）是设的什么值
纹理图片B1映射到画布区域C（屏幕）时：
    <==> 维度值(x,y)满足x∈[a,b)，y∈[d,e)，(x-a)%c==0且(y-d)%f==0，则对应纹理图片B1的“纹素坐标”为((x-a)/(b-a)+(1.0/m)/2.0,(y-d)/(e-d)+(1.0/n)/2.0)
    <==> 讨论在x∈[a,b)，y∈[d,e)，(x-a)%c!=0或(y-d)%f!=0时对应纹理图片B1的“纹理坐标”（不包含纹素坐标）为((x-a)/(b-a)+(1.0/m)/2.0,(y-d)/(e-d)+(1.0/n)/2.0)：具体像素值（颜色值rgba）需根据以下两点综合分析：
            1）绑定纹理对象时设置的参数（gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER | gl.TEXTURE_MAG_FILTER,?)）：当B和C的大小不完全相同，WebGL需要填充由于放大而造成的像素间的空隙，由于缩小剔除纹理图像中的部分像素
            2）B与C的相对大小（B和C的大小必须都是整数）
    <==> 讨论边界情况的像素值（颜色值rgba）：即x=b、y=e的情况。具体像素值（颜色值rgba）需根据以下两点综合分析：
            1）绑定纹理对象时设置的参数（gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S | TEXTURE_WRAP_T, gl.LINEAR,?)）
            2）B与C的相对大小（B和C的大小必须都是整数）
```
```
例子1-1：有一张等格点经纬度气象图片
长度*宽度有[m=1440]*[n=721]个维度值要存到canvas2D图片中，其中坐标范围：m∈[-180.0,180.0)，间隔为0.25；n∈[-90.0,90.25)，间隔为0.25.
    <==> (180.0-(-180.0))/0.25==1440，(90.25-(-90.0))/0.25==721
canvas2D图片A：
    <==> canvas2D图片大小=[1440像素]*[721像素]
    <==> canvas2D图片的canvas坐标范围[0,1440)*[0,721)
    <==> canvas2D图片中每个像素的区域大小=[1]*[1]
原始纹理图片B：
    <==> 纹理图片大小=[1440像素]*[721像素]
    <==> 纹理图片的纹素坐标范围[0.0,1.0)*[0.0,1.0)
    <==> 纹理图片中每个纹素的区域大小=[1.0/1440]*[1.0/721]
新的纹理图片B1：
    <==> 纹理图像映射到图形上的具体方式：
         1）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)，
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
         2）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)，
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
纹理图片B1映射到画布区域C（屏幕）时：
    <==> 维度值(x,y)满足x∈[-180.0,180.0)，y∈[-90.0,90.25)，(x-(-180.0))%0.25==0且(y-(-90.0))%0.25==0（即正好是经纬度格点坐标），则对应纹理图片B1的“纹素坐标”为((x-(-180.0))/(180.0-(-180.0))+(1.0/1440)/2.0,(y-(-90.0))/(90.25-(-90.0))+(1.0/721)/2.0)
    <==> 讨论在x∈[-180.0,180.0)，y∈[-90.0,90.25)，(x-(-180.0))%0.25!=0或(y-(-90.0))%0.25!=0时对应纹理图片B1的“纹理坐标”（不包含纹素坐标）为((x-(-180.0))/(180.0-(-180.0))+(1.0/1440)/2.0,(y-(-90.0))/(90.25-(-90.0))+(1.0/721)/2.0)：具体像素值（颜色值rgba）分析如下：
           由gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)，gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
           得维度值(x,y)对应的像素值=纹理图片中纹素坐标Math.floor(((x-(-180.0))/(180.0-(-180.0)),((y-(-90.0))/(90.25-(-90.0)))/(1.0/1440.0,1.0/721.0)) * (1.0/1440.0,1.0/721.0))+((1.0/1440)/2.0,(1.0/721)/2.0)的纹素值（颜色值rgba）
                与Math.ceil(((x-(-180.0))/(180.0-(-180.0)),((y-(-90.0))/(90.25-(-90.0)))/(1.0/1440.0,1.0/721.0)) * (1.0/1440.0,1.0/721.0))+((1.0/1440)/2.0,(1.0/721)/2.0)的纹素值（颜色值rgba）
                经过gl.LINEAR双线性插值后的像素值
    <==> 讨论边界情况的像素值（颜色值rgba）：即x=180.0、y=90.25的情况（y=90.25这个情况没有实际意义，因为纬度不可能超过90°，但还是可以讨论下）。具体像素值（颜色值rgba）分析如下：
            由gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)，
            得当x=180.0时，其像素值（颜色值rgba）与x=-180.0所对应的纹理图片B1的“纹素坐标”相同，即与(((-180.0)-(-180.0))/(180.0-(-180.0))+(1.0/1440)/2.0,(y-(-90.0))/(90.25-(-90.0))+(1.0/721)/2.0)=(0.0,(y-(-90.0))/(90.25-(-90.0))+(1.0/721)/2.0)的纹素值（颜色值rgba）相同；
            由gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)，
            且gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)，gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            并且C的大小是B的D倍（B和C的大小必须都是整数）；
            得当y=90.25时，其像素值（颜色值rgba）对应纹理图片B1中纹理坐标((x-(-180.0))/(180.0-(-180.0))+(1.0/1440)/2.0,(((90.25-0.25/D)-(-90.0))/(90.25-(-90.0)))的像素值（颜色值rgba）（这个像素值是经过gl.TEXTURE_MAG_FILTER和gl.TEXTURE_MIN_FILTER填充空隙后的值）；
```
```
例子1-2：色卡[值，颜色]=[
[0.2, [2, 20, 0, 1]], 
[0.4, [4, 40, 0, 1]], 
[0.7, [7, 70, 0, 1]],
]
为了能让色卡气象值与“x轴坐标”成比例，需要求出各个色卡气象值的「最小间隔」，好让各个色卡气象值正好在x轴坐标上：
先算出相邻色卡气象值之间的距离：（0.4-0.2）=0.2，（0.7-0.4）=0.3；
然后求出所有距离值的最大公约数：0.2和0.3的最大公约数为0.1，即间隔为c=0.1。
最大公约数只能算整数，所以要把小数转换成整数，同时乘100、1000等等。求出公约数后再除以100、1000等等，就是最小间隔了

1、按长度m=6做x循环
1-1、按照公式匹配：（value-value0）/c=（value-0.2）/0.1=（x-x0）/1=（x-0）/1，求出对应像素点x的气象值value
1-2、按照公式匹配：x≥nearestMin且x<nearestMax。与传入参数色卡比较，求出当前气象值value在哪两个色卡气象值之间。要注意最后一个色卡颜色值没nearestMax，那样就数组索引越界了
1-3、按照公式匹配：(value-nearestMin)/(nearestMax-nearestMin)=(rgba-nearestMinRgba)/(nearestMaxRgba-nearestMinRgba)。分别求出当前气象值对应的线性渐变颜色值rgba

todo：gl.NEAREST和gl.LINEAR取值方式不同，不能像渐变那样直接平铺取值，因为定义是相邻两个色卡气象值之间的颜色都取左边的色卡气象值的颜色

todo：其实求色卡这一步可以放后台bigdecimal来算，以避免前台计算机float计算误差0.0000001的问题

长度*宽度有[m]*[n]个维度值要存到canvas2D图片中，其中坐标范围：m∈[a=0.2,b=0.7+0.1=0.8)，间隔为c=0.1；n∈[d=0.0,e=1.0)，间隔为f=1.0.
    <==> (b-a)/c==m，(e-d)/f==n
    <==> m=6，n=1
canvas2D图片A：
    <==> canvas2D图片大小=[6像素]*[1像素]
    <==> canvas2D图片的canvas像素坐标范围[0,6)*[0,1)
    <==> canvas2D图片中每个像素的区域大小=[1]*[1]
原始纹理图片B：
    <==> 纹理图片大小=[6像素]*[1像素]
    <==> 纹理图片的纹素坐标范围[0.0,1.0)*[0.0,1.0)
    <==> 纹理图片中每个纹素的区域大小=[1.0/6]*[1.0/1]
新的纹理图片B1（渐变）：
    <==> 纹理图像映射到图形上的具体方式：
         1）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)，
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
         2）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)，
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
新的纹理图片B2（非渐变）：
    <==> 纹理图像映射到图形上的具体方式：
         1）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)，
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
         2）gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)，
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
```

## canvas2D图片/纹理图片的像素值（RGBA）
- canvas2D图片像素值范围为[0,255];纹理图片像素值范围为[0,1]。都是闭区间的，而不像canvas2D图片/纹理图片坐标系那样左闭右开
- 总结：数据真实值和像素值（RGBA）之间的换算关系
```
数据真实值c，其中真实值范围：c∈[a,b]
    <==> canvas2D图片像素值=(c-a)/(b-a)*255
    <==> 纹理图片像素值texture2D(u_sampler2D,[纹理坐标])=(c-a)/(b-a)。[纹理坐标]可通过例子1-1获得
```

## 等经纬度格点热力图：
- 顶点着色器：用两个三角形画全屏幕像素，在顶点着色器执行6次
    - 将屏幕顶点坐标系顶点坐标vec2 a_screen_pos转换成对应纹理坐标系纹理坐标vec2 v_screen_texPoint：虽然在片元着色器转换也行，但在顶点着色器转换的话就不用在片元着色器中多次转换了，而是让WebGL光栅化，提高了效率
    - 对v_screen_texPoint进行图元装配+光栅化过程
- 图元装配+光栅化过程
    - 对6个顶点对应的v_screen_texPoint进行图元装配+光栅化过程，得到6个顶点包围的三角形范围内所有像素点的v_screen_texPoint值
    - 将v_screen_texPoint传入片元着色器
- 片元着色器
    - 通过纹理坐标v_screen_texPoint求得当前顶点坐标对应的经纬度vec2 lon_lat
        - 通过Mapbox转换公式将纹理坐标v_screen_texPoint转换为对应Mapbox瓦片坐标vec4 tile_pos
        - 通过Mapbox瓦片坐标tile_pos转换为经纬度vec2 lon_lat
    - 通过经纬度lon_lat去纹理图片u_texture_lon_lat_meteoRateValue中取出对应经纬度的气象值
        - 通过经纬度lon_lat，所定义的纹理图片经纬度范围去纹理图片u_texture_lon_lat_meteoRateValue中取出对应经纬度的气象比例值vec4 meteoRateValue
        - 通过气象最小最大值将气象比例值换算为气象值vec4 meteoValue
    - 通过气象值meteoValue去纹理图片u_texture_meteoValue_0_color中取出对应气象值meteoValue的颜色值vec4 rgba
        - 如果meteoValue只有r通道有效，那么就根据所定义的纹理图片气象值范围去纹理图片u_texture_meteoValue_0_color中取出对应气象值meteoValue.r的颜色值vec4 meteoValueColor
        - 将meteoValueColor赋值给gl_FragColor

## Project setup
```
全整理完以后，想要把这些东西真正变成自己的东西，就需要在不看代码的情况下，从顶点着色器开始想要怎么做，一步一步想。
像风杆，本身只需要一对着色器就可以完成了。结果后来做成了两个，后期没去优化
```
### 待解决问题
```
- 色卡渐变和非渐变算的对么，主要是比例对么，要重新想下，渐变和非渐变都要算下
mapbox瓦片源码分析，孙哥是怎么扒出来的源码
风杆中，屏幕大小除以风杆图标大小必须是整数，小数是错的，会偏差，要想办法解决。3D错的，瓦片正好对上，是整数
canvas图片和纹理图片坐标系关于x轴对称（y轴相反）
```
## 易忽略点
- 头部要确定精度：precision highp float;precision highp int;

- [ ] WebGL2：字节计算
~~播放时会用到lodash.debounce()和lodash.throttle();
~~刷新存储配置：有点像缓存但又不是，以前都是localstorage，nullschool是存到window.location.hash地址中，可以学下；
电脑触摸屏
有个取消任务机制，在开启线程后，如果有取消操作，就把原先的线程停了，通过在线程里加参数判断，如果cancel.requested==true就直接return,这样就不会继续进行无效的线程了，但也要在后面所有的方法中加判断，要不第一步的错误数据可能会影响

- [ ] Webgl 先把js的数据都对一遍看对么，再看GLSL

- [ ] mod (-1.0,3.0)==2.0!=-1.0，跟js不一样

- [ ] 在要写varying 变量时，应考虑从顶点着色器到片元着色器时会对varying 进行怎样的光栅化过程，是否需要的是光栅化后的结果，还是说把这部分不需要光栅化的内容留到片元着色器去写

- [ ] varying变量取值范围是0-1，所以在顶点着色器赋值时，要把值范围缩到0~1之间，可以变成四通道。然后在片元着色器取值时，再把值反过来换算下得到真实的值

- [ ] 在开发时，经常碰到登陆一会就连接超时的情况。但默认session 超时是30分钟，就不是time-out 的问题。后来孙哥说用cocurrent session时，限制同一个用户只能在一个地方登陆，而开发时他们用的是同一个账号，导致一个人在操作时另一个人突然登陆踢掉前一个人，所以就出现经常断线的情况了……那怎么确定是这个情况呢？日志很重要，打日志，谁在什么时间登陆，什么时候session 过期，什么时候注销，就一目了然了。……可见日志很重要啊，框架一定要有日志
- [ ] 气象文件gfs文件解析时找不出来APCP降雨量六小时间隔和一小时间隔的区别。这时就自己闷头找百度资料，怎么找也找不出来，看代码也找不到。其实应该看下专业人士或者专业软件ArcGIS,QGis它们能区分开么？结果发现他们果然能区分开，而且还标明是什么属性不一样。总结就是：在做一件以前从没做过的东西的时候，或者在无法确定某件事情是否可行时，应该先去找专业人士和专业软件来查找信息，然后再确定下一步工作
- [ ] 最后是怎么找到两种降雨量的参数区别的呢？百度上关于grib2的资料几乎没有，看NetCDF 文档也没找到想要的，最后还是翻NetCDF 源码才找到的。NetCDF源码里面有个可以显示所有grib2参数的静态方法，在静态类Grib2Show中，这个类里面还有其他静态方法可以调用。想想也是，源码展示的更清晰些
- [ ] NetCDF文件格式可以研究一波，是存储数据的一种方案，压缩性很强。可以解析nc和grib2文件
- [ ] 模块之间耦合度还是要低一些，像气象下载模块和解析模块现在耦合度就比较高。有的文件想要被解析还得经过下载模块下载后特殊处理才行，这样显然不合逻辑，如果单独就想用解析模块反而还无法解析文件，比如现在的grib2文件就无法用解析模块解析，而是先在下载模块做切片处理后，才能解析
- [ ] 写框架要写readme ，可以用swagger框架
- [ ] 偷懒必将付出代价，就像上海气象ec1文件命名 ，本来只想让预报时间匹配文件名后面那部分，结果凑巧前面有部分跟要匹配的预报时间一样，而这个前半部分匹配上预报时间的并不是代表预报时间，而是批次时间，这就导致错误了。所以能做精确的就尽量做精确，不要耍小聪明
- [ ] nginx和服务器在同一台机器的话，如果项目也部署在服务器的话，那么要访问本服务器要用nginx服务名，而不是ip ，就像连接数据库一样，要写mariadb 
- [ ] 区块链，AI要看看，不过要先看数据结构和算法
- [ ] 等值线的参考网站还有d3-contour 
- [ ] 后台地理坐标系转换应该搜下有没有maven 仓库现成jar 包
- [ ] 看文档写东西时，发现属性没起作用，控制台报错。这个可能是引用的版本不够高，旧版本还没支持这个属性。如我当时写mapbox的filter 时就没好用，新属性用不了
- [ ] 要多和人沟通交流
图片传输的时候用lerc压缩一下 客户端解压出来 加上去
- 上面的一切推导都是由数学逻辑推导到计算机上的，所以一切都要从数学角度开始想。毕竟计算机只是数学的一个应用而已，当然得从源头“数学思想”开始进行逻辑推导啊！！！

```
// 取需要相乘的值的坐标对应的在纹理上的位置
        // 防止取到边界 增加一个位置偏移量 以取到像素块正中央
```
```
 // 传入9个像素点, 设置中定义为3*3的纹理
    const colorMap = new Uint32Array([
        0xFF0000FF, 0x00FF00FF, 0x0000FFFF,
        0xFFFF00FF, 0xFF00FFFF, 0x00FFFFFF,
        0x000000FF, 0xFFFFFFFF, 0xF0F0F0FF,
    ]);
    // 注意, Uint32Array转换为Uint8Array时的数值顺序。前端大小字节序问题，可以通过DataView来使顺序正确
    const RGBAMap = new Uint8Array(colorMap.buffer);
```
```
优化：
gpu计算能力很猛：
百度人工智能大规模采用gpu，PhysX碰撞检测使用gpu提速……种种类似的现象都表明了gpu在单纯的计算能力上是超过普通的cpu，而我们关注一下前一节shader里面的代码。
而每个顶点都需要做对象坐标->世界坐标->眼睛坐标的变换，如果传入三个顶点，就代表gpu需要将proMatrix * viewMatrix * modelMatrix计算三次，而如果我们在js中就计算好，当作一个矩阵传给gpu，则是极好的。js中虽然计算起来相较gpu慢，但是胜在次数少啊。

js与shader交互的成本：
核心在避免多次改变uniform，比方说我们可以尝试用attribute去代替uniform
流线每帧都绑定uniform，不应该，应该做个最外层初始化
切换program的成本：
这里说的是少切换program，而不是说不要切换program，从理论上来说可以单个program写完整个程序的呀，那什么时候又需要切换program呢？
program的作用是代替if else语句，相当于把if else抽出来单独一个program，所以就是如果一个shader里面的if else多到开销超过program的开销，此时我们就能选择用program啦。


```
兼容webgl1和webgl2
只做一点说明 in将变量标记输入 out将变量标记输出 在webgl 1.0中 attribute表示输入 所以在js获取变量地址的时候使用了getAttribLocation函数 其中的Attrib即是这个意思 但是在webgl 2.0这个声明被弃用 使用in来代替

另外图片传入可以选择多种方式 直接用<img>标签也可以 或者直接传入像素值也可以 具体方式可以查看texImage2D文档
当然传入透明的值也是可以的 绘制到画布上的话 真的是透明的 相当神奇
但如果是像素值传入 也可以有多种格式 本例子中将RGBA拆开成四个值分别传入 为了方便起见 可以直接使用类型数组直接将32位转成8位 但是这样的转化方式可能会引起顺序不一致 比如[0x01020304] 会被拆成[0x04, 0x03, 0x02, 0x01] 具体相关内容可以参考类型数组

使用Texture解决了要传入大量数据的问题 但是使用比较复杂 而且数据传输也是相当地耗时 所以还是期待多维数组Arrays of Arrays 能早一天在浏览器上支持

注意 gl.readPixels方法必须和gl.drawArrays方法在同一个执行队列中同步执行 否则会无法读取到数据
读取的顺序和纹理写入的顺一致 都是从左下开始 沿x正方向读取一行 再向y方向读取各行 最后合并成一个完整的数组 如果输入输出和这个顺序有关的话 需要注意一下

里面有个U_TEXTURE_POS_FIX常量 用来修正texture取值的时候的位置 以免取到像素边界上造成不必要麻烦

WebGPU可以用来直接操作GPU做矩阵计算，比如克里金插值就不用WebGL了

- 非等格点：
    - 一个屏幕像素对应一个经纬度，一个经纬度可以对应多个屏幕像素。
    - 所以如果要把九公里画到多个-180~180地图范围内，不应该以经纬度图片为起始条件，而应该以画所有屏幕像素点（两个大三角形、或三角带也行，看情况）为条件，
    - q1：通过画像素点，把像素点转换成经纬度；再去经纬度图片。。。。。。这里有转换的问题！！！
    - 这样屏幕上该画的像素点才能都画上，不会只画在一个-180~180地图上
    - 这个方法有问题：在q1步骤有问题
------
新技术WebGPU：
Babylon.js 成为首个集成 WebGPU 的图形引擎

确实很可惜。
大佬都是自己玩自己的，太可恶了！
有一个标准，大家一起玩，多好！
讨厌的是，大佬们不这样想，都想玩自己的，把别人玩死。
祝想把别人玩死的，自己先死！

for (int i = 0; i < h; i++) 
{ 
   rr = r0 + (r1 - r0)/h*i; 
   gg = g0 + (g1 - g0)/h*i; 
   bb = b0 + (b1 - b0)/h*i; 
   g.setColor(rr < < 16 | gg < < 8 | bb); 
   g.drawRect(x , y + i, w - 1, 0); 
} 
考虑到执行效率 可以将(r1-r0)/h,(g1-g0)/h,(b1-b0)/h提出至循环外

double dDeltaR = (r1-r0)/h;
double dDeltaG = (g1-g0)/h;
double dDeltaB = (b1-b0)/h;

for (int i = 0; i < h; i++) 
{ 
   rr = r0 + dDeltaR*i; 
   gg = g0 + dDeltaG*i; 
   bb = b0 + dDeltaB*i; 
   g.setColor(rr < < 16 | gg < < 8 | bb); 
   g.drawRect(x , y + i, w - 1, 0); 
} 


        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        