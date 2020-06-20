import {MeteoImage, MeteoArrayBuffer} from "../../../image";
import {mat4} from "gl-matrix";
import {WebGL, GLFbo, GLTwinsFbo, GLProgram, BufferObject} from "../../../gl";
import vert from "./glsl/vert.glsl";
import frag from "./glsl/frag.glsl";
import mapboxgl from "mapbox-gl";
import IWebGL, {MeteoResultInterface} from "@/util/meteo/thor-meteo-final";
import {
    MeteoTypeConfigurationInterface,
    MeteoSourceConfigurationInterface,
    MeteoSourceIndex, ProductParamsInterface
} from "@/util/meteo/thor-meteo-final/meteo";
import {BoxMap} from "@/components/map/ts/mapOption";

const TILESIZE_DEFAULT = 256;
const TEXTURE_INDEX_COLOR = 9;
const TEXTURE_INDEX_DATA = 8;

export class CustomLayerShade implements IWebGL {
    private map: any;
    private gl!: WebGLRenderingContext;
    private visiable!: boolean;
    private program!: GLProgram;
    private meteo: Array<MeteoResultInterface>;
    private _id: string;
    private type: string;
    private renderingMode: string;
    private dataTexture: any;
    private meteoArrayBuffer: MeteoArrayBuffer;
    private wgl!: WebGL;
    private posBuffer!: WebGLBuffer;

    set id(value: string) {
        this._id = value;
    }

    get id(): string {
        return this._id;
    }

// fixme:从Mapbox 0.50.0开始支持的自定义层
    constructor(map: mapboxgl.Map, layerName: string) {
        this.meteo = new Array<MeteoResultInterface>();
        this.map = map;
        this.meteoArrayBuffer = new MeteoArrayBuffer();
        this._id = layerName;
        this.type = 'custom';
        this.renderingMode = '3d';
    }

    onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
        // console.log("执行onAdd()")
        this.gl = gl;
        this.wgl = new WebGL(gl);
        this._initGL();
    }

    _initGL() {
        const gl = this.gl;
        this.program = this.wgl.createProgram(this.wgl.compileShader(gl.VERTEX_SHADER, vert), this.wgl.compileShader(gl.FRAGMENT_SHADER, frag));

        //初始化静态信息
        const posBuffer=this.posBuffer = this.wgl.createBuffer(new Float32Array([1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1]));
        this.wgl.bindAttribute(this.program.attribute["a_position"], posBuffer, 2);
        this.program.use();
        this.wgl.gl.uniform1f(this.program.uniform["u_opacity"], 0.8);
    }

    setColor(color: Array<any>) {
        this.program.use();
        const color2D = this.wgl.createColorRamp(color);
        this.wgl.createTexture(TEXTURE_INDEX_COLOR, color2D.length / 4, 1, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.gl.LINEAR, color2D);
        this.wgl.gl.uniform1i(this.program.uniform["u_color"], TEXTURE_INDEX_COLOR);
        this.wgl.gl.uniform2fv(this.program.uniform["u_cmm"], new Float32Array([color[0][0], color[color.length - 1][0]]));
    }

    load(url: number, meteoTypeConfiguration: MeteoTypeConfigurationInterface, meteoSourcePrecision: number,productParams: ProductParamsInterface): Promise<Array<MeteoResultInterface>> {
        return new Promise((resolve, reject) => {
            this.meteoArrayBuffer.load(url, meteoTypeConfiguration, meteoSourcePrecision, productParams).then((meteoData: Array<Float32Array>) => {
                // debugger
                let meteoResults: Array<MeteoResultInterface> = [];
                if (meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.GFS
                    || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.MARITIME
                    || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.HYCOM
                    || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.SHH_WW
                    || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.EC_C1D
                    || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.EC_C2P
                    || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.SAT_WIND) {
                    for (let sourceIndex = 0; sourceIndex < meteoTypeConfiguration.meteoSourceConfiguration.length; sourceIndex++) {
                        let currentMeteoSourceConfiguration: MeteoSourceConfigurationInterface = meteoTypeConfiguration.meteoSourceConfiguration[sourceIndex];
                        for (let typeIndex = 0; typeIndex < meteoTypeConfiguration.meteoTypeIndex.length; typeIndex++) {
                            // fixme；arrayBuffer是从服务器/java传来的大端字节序二进制数据流，要转换成小字节序二进制数据流
                            let originalData: Float32Array = this.meteoArrayBuffer.getFloatArray(meteoData[typeIndex]);
                            meteoResults.push(this.meteoArrayBuffer.resolveData(originalData, currentMeteoSourceConfiguration, meteoSourcePrecision));
                        }
                    }
                } else {
                    /*for (let sourceIndex = 0; sourceIndex < meteoTypeConfiguration.meteoSourceConfiguration.length; sourceIndex++) {
                        // 获取不同气象来源通用的文件
                        let currentMeteoSourceConfiguration: MeteoSourceConfigurationInterface = meteoTypeConfiguration.meteoSourceConfiguration[sourceIndex];
                        currentMeteoSourceConfiguration.baseComponent.then((baseComponentData: Array<Float32Array>) => {
                            for (let typeIndex = 0; typeIndex < meteoTypeConfiguration.meteoTypeIndex.length; typeIndex++) {
                                // 获取不种气象类型的数据文件
                                let currentMeteoTypeIndex: MeteoTypeIndex = meteoTypeConfiguration.meteoTypeIndex[typeIndex];
                                // fixme；arrayBuffer是从服务器/java传来的大端字节序二进制数据流，要转换成小字节序二进制数据流
                                let originalData = this.meteoArrayBuffer.getFloatArray(data);
                                this.meteoArrayBuffer.resolveData(originalData, meteoTypeConfiguration, meteoSourcePrecision);

                                for (let additionalFileIndex = 0; additionalFileIndex < meteoTypeConfiguration.baseComponentUrl.length; additionalFileIndex++) {
                                    // 获取不同气象类型所要加载的额外文件
                                    let currentBaseComponentUrl: string = meteoTypeConfiguration.baseComponentUrl[additionalFileIndex];
                                }
                            }
                        })
                    }*/
                }


                resolve(meteoResults);
            }).catch(reason => {
                reject(reason);
            });
        });
    }

    loadMeteo(meteoResults: Array<MeteoResultInterface>, meteoTypeConfiguration: MeteoTypeConfigurationInterface) {
        if (meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.GFS
            || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.MARITIME
            || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.HYCOM
            || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.SHH_WW
            || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.EC_C1D
            || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.EC_C2P
            || meteoTypeConfiguration.meteoSourceConfiguration[0].meteoSourceIndex == MeteoSourceIndex.SAT_WIND) {
            this.program.use();
            this.meteo = new Array<MeteoResultInterface>();
            // 形成数据纹理
            this.dataTexture = this.wgl.createTexture(TEXTURE_INDEX_DATA, meteoResults[0].width, meteoResults[0].height, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.gl.LINEAR, this.meteoArrayBuffer.mergeGridPixelData(meteoResults));
            this.wgl.gl.uniform1i(this.program.uniform["u_data"], TEXTURE_INDEX_DATA);
            this.wgl.gl.uniform3fv(this.program.uniform["u_lon"], meteoResults[0].lon);
            this.wgl.gl.uniform3fv(this.program.uniform["u_lat"], meteoResults[0].lat);
            this.wgl.gl.uniform2fv(this.program.uniform["u_min"], [meteoResults[0].minAndMax[0], meteoTypeConfiguration.computeAsVector[1] ? meteoResults[1].minAndMax[0] : 0]);
            this.wgl.gl.uniform2fv(this.program.uniform["u_max"], [meteoResults[0].minAndMax[1], meteoTypeConfiguration.computeAsVector[1] ? meteoResults[1].minAndMax[1] : 0]);
            if (meteoTypeConfiguration.computeAsVector[1])
                this.wgl.gl.uniform1f(this.program.uniform["u_type"], 2.0);
            else
                this.wgl.gl.uniform1f(this.program.uniform["u_type"], 1.0);
            this.meteo = meteoResults;
        }


        /*for (let sourceIndex = 0; sourceIndex < meteoTypeConfiguration.meteoSourceConfiguration.length; sourceIndex++) {
            // 获取不同气象来源通用的文件
            let currentMeteoSourceConfiguration: MeteoSourceConfigurationInterface = meteoTypeConfiguration.meteoSourceConfiguration[sourceIndex];
            currentMeteoSourceConfiguration.baseComponent.then((baseComponentData: Array<Float32Array>) => {
                for (let typeIndex = 0; typeIndex < meteoTypeConfiguration.meteoTypeIndex.length; typeIndex++) {
                    // 获取不种气象类型的数据文件
                    let currentMeteoTypeIndex: MeteoTypeIndex = meteoTypeConfiguration.meteoTypeIndex[typeIndex];

                    for (let additionalFileIndex = 0; additionalFileIndex < meteoTypeConfiguration.baseComponentUrl.length; additionalFileIndex++) {
                        // 获取不同气象类型所要加载的额外文件
                        let currentBaseComponentUrl: string = meteoTypeConfiguration.baseComponentUrl[additionalFileIndex];
                        // fixme；arrayBuffer是从服务器/java传来的大端字节序二进制数据流，要转换成小字节序二进制数据流
                        let originalData = this.meteoArrayBuffer.getFloatArray(data);
                        this.meteoArrayBuffer.resolveData(originalData, meteoTypeConfiguration, meteoSourcePrecision);
                    }
                }
            })
        }*/
        /*this.program.use();
        this.meteo = null;
        // 形成数据纹理
        this.dataTexture = this.wgl.createTexture(TEXTURE_INDEX_DATA, meteo.width, meteo.height, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.gl.LINEAR, meteo.data);
        this.wgl.gl.uniform1i(this.program.uniform["u_data"], TEXTURE_INDEX_DATA);
        this.wgl.gl.uniform3fv(this.program.uniform["u_lon"], meteo.lon);
        this.wgl.gl.uniform3fv(this.program.uniform["u_lat"], meteo.lat);
        this.wgl.gl.uniform2fv(this.program.uniform["u_min"], [meteo.minAndMax[0][0], shadeParams.computeAsVector[1] ? meteo.minAndMax[1][0] : 0]);
        this.wgl.gl.uniform2fv(this.program.uniform["u_max"], [meteo.minAndMax[0][1], shadeParams.computeAsVector[1] ? meteo.minAndMax[1][1] : 0]);
        if (shadeParams.computeAsVector[1])
            this.wgl.gl.uniform1f(this.program.uniform["u_type"], 2.0);
        else
            this.wgl.gl.uniform1f(this.program.uniform["u_type"], 1.0);
        this.meteo = meteo;*/

        // this._render();
    }

    render(gl: any, matrix: any) {
        // fixme:0号纹理不能用，mapbox自己用好像
        // fixme:viewport也不用设置了
        // fixme:每个地方都得用gl.useProgram(this.program);，要不然找不到program
        if (this.meteo.length < 1) return;
        if (!this.visiable) return;
        this.program.use();
        this.wgl.gl.uniformMatrix4fv(this.program.uniform["u_matrix_invert"], false, this._matrixInvert());
        this.wgl.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_INDEX_DATA);
        this.wgl.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture);
        this.wgl.bindAttribute(this.program.attribute["a_position"], this.posBuffer, 2);
        this.wgl.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    _matrix() {
        const scale = this.map.transform.worldSize;
        const matrix = mat4.identity(<mat4>new Float32Array(16));
        mat4.scale(matrix, matrix, [scale, scale, 1]);
        mat4.multiply(matrix, this.map.transform.projMatrix, matrix);
        return matrix as Float32Array;
    }

    _matrixInvert() {
        return mat4.invert(<mat4>new Float32Array(16), <mat4>this._matrix()) as Float32Array;
    }

    show() {
        this.visiable = true;
        this.map.setLayoutProperty(this._id, 'visibility', 'visible');
        // this._render();
    }

    hide() {
        this.visiable = false;
        this.wgl.gl.clearColor(0, 0, 0, 0);
        this.wgl.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.map.setLayoutProperty(this._id, 'visibility', 'none');
    }

    setZIndex(z: string) {
        if (z == "-1") {    // 被地图覆盖
            this.map.moveLayer(this._id, BoxMap.BASELAYER);
        } else {       // 不被地图覆盖eteoOptions.DISPLAY_TYPE.shade || displayType === MeteoOptions.DISPLAY_TYPE.shade1) {
            this.map.moveLayer(BoxMap.BASELAYER, this._id);
        }
    }

    setOpacity(opacity: number) {
        this.gl.uniform1f(this.program.uniform["u_opacity"], opacity);
    }

    removeContext() {
        const extension = this.gl.getExtension('WEBGL_lose_context');
        if (extension) {
            extension.loseContext();
        }
    }
}
