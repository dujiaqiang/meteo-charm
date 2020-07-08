type BufferData =
    Int8Array
    | Int16Array
    | Int32Array
    | Uint8Array
    | Uint16Array
    | Uint32Array
    | Uint8ClampedArray
    | Float32Array
    | Float64Array
    | DataView
    | ArrayBuffer
    | null;

export class WebGL {
    static readonly colorTypes: Array<string> = ["gradient", "ungradient"];
    public gl: WebGLRenderingContext;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
    }

    public createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): GLProgram {
        return new GLProgram(this.gl, vertexShader, fragmentShader);
    }

    public createBuffer(data: BufferData): WebGLBuffer {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        if (!buffer) throw "buffer create failure!";
        return buffer;
    }

    public compileShader(type: number, source: string): WebGLShader {
        let shader: WebGLShader | null = this.gl.createShader(type);
        if (shader) {
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);
        }
        if (!shader) throw "shader is null!";
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw this.gl.getShaderInfoLog(shader)
        }
        return shader;
    }

    public createTexture(index: number, width: number, height: number, internalFormat: number, format: number, type: number, filter: number, data: ArrayBufferView | TexImageSource | null): WebGLTexture | null {
        const gl = this.gl;
        const texture = gl.createTexture();
        // todo：这里改了
        if (index !== undefined) {
            gl.activeTexture(gl.TEXTURE0 + index);    // 666，还能这么写
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        if (data == null || data instanceof Uint8Array) {
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data as ArrayBufferView);    // todo 怎么参数变多了
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, type, data as TexImageSource);
        }
        // todo:这里加了句
        // gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    public createFBO(id: number, width: number, height: number, internalFormat: number, format: number, type: number, param: number, data: ArrayBufferView | null): GLFbo {
        const gl = this.gl;
        let texture = this.createTexture(id, width, height, internalFormat, format, type, param, data);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (!texture || !fbo) throw "fbo create failure!";
        return new GLFbo(id, texture, fbo);
    }

    public createTwinsFbo(id: number, width: number, height: number, internalFormat: number, format: number, type: number, param: number, data: ArrayBufferView | null): GLTwinsFbo {
        return new GLTwinsFbo(this.gl, this.createFBO(id, width, height, internalFormat, format, type, param, data), this.createFBO(id, width, height, internalFormat, format, type, param, null));
    }

    public bindAttribute(attribute: number, buffer: WebGLBuffer, step: number): void {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, step, gl.FLOAT, false, 0, 0);
    }

    public bindTexture(texture: WebGLTexture, index: number): void {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    public viewport(width: number, height: number): void {
        this.gl.viewport(0, 0, width, height);
    }

    public bindFrameBuffer(fbo: WebGLFramebuffer | null) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    }

    public unbindFrameBuffer(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }

    /**
     * 画整个屏幕(2三角形0-1)
     * @param attribute
     * @param buffer
     */
    public drawQuad(attribute: number, buffer: WebGLBuffer): void {
        const gl = this.gl;
        this.bindAttribute(attribute, buffer, 2);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    public createColorRamp(colors: Array<any>, colorType = WebGL.colorTypes[0], isolineValue = 1, dataOffset = 0): Uint8Array {
        const min = colors[0][0];
        const max = colors[colors.length - 1][0];
        let length = 250;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        canvas.width = length;
        canvas.height = 1;

        if (colorType == WebGL.colorTypes[0]) {   // 渐变色卡
            const gradient = ctx.createLinearGradient(0, 0, length, 0);
            for (let m = 0; m < colors.length; m++) {
                gradient.addColorStop(fract(min, max, colors[m][0]), toColor(colors[m][1]));
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, length, 1);
        } else if (colorType == WebGL.colorTypes[1]) {   // 非渐变色卡    // fixme:只单独显示热力图、或者是原先的雷达图那些，色卡就按原来那么创建
            // let colors1 = JSON.parse(JSON.stringify(colors));
            let colors1 = [...colors];  // ES6深拷贝数组，要不reverse()会改变原数组
            let num = 0;
            for (let i = 0; i < length; i++) {
                let x = i / (length - 1) * (max - min) + min;
                if (x < colors1[((num + 1 >= length - 1) ? (length - 1) : (num + 1))][0]) {

                } else {
                    num++;
                }
                ctx.fillStyle = toColor(colors1[num][1]);
                ctx.fillRect(i, 0, 1, 1);
            }
        } else {  // fixme:色卡不渐变==>(3)做出来的色卡要按间距分，比如间距是2，如果从0开始算，色卡有个35，那么它的颜色按34的来，新的颜色从36开始
            let dataMin = Math.floor((min + dataOffset) / isolineValue) * isolineValue - dataOffset;
            let dataMax = Math.ceil((max + dataOffset) / isolineValue) * isolineValue - dataOffset;
            // 重新改变
            length = (dataMax - dataMin) / isolineValue + 1;
            // let colors1 = JSON.parse(JSON.stringify(colors));
            let colors1 = [...colors];  // ES6深拷贝数组，要不reverse()会改变原数组
            let num = 0;
            for (let i = 0; i < length; i++) {
                let x = i / (length - 1) * (dataMax - dataMin) + dataMin;
                if (x < colors1[num + 1][0]) {

                } else {
                    num++;
                }
                ctx.fillStyle = toColor(colors1[num][1]);
                ctx.fillRect(i, 0, 1, 1);
            }
        }


        return new Uint8Array(ctx.getImageData(0, 0, length, 1).data);  // todo:获取从0-length的所有像素值
        function fract(min: number, max: number, val: number) {
            return (val - min) / (max - min);
        }

        function toColor(c: Array<number>) {
            return "RGBA(" + c[0] + "," + c[1] + "," + c[2] + "," + c[3] + ")";
        }
    }
}

export class GLFbo {
    private _index: number;
    private _texture: WebGLTexture;
    private _fbo: WebGLFramebuffer;

    constructor(index: number, texture: WebGLTexture, fbo: WebGLFramebuffer) {
        this._index = index;
        this._texture = texture;
        this._fbo = fbo;
    }

    get index(): number {
        return this._index;
    }

    get texture(): WebGLTexture {
        return this._texture;
    }

    get fbo(): WebGLFramebuffer {
        return this._fbo;
    }
}

export class GLTwinsFbo {

    private _current: GLFbo;
    private _buffer: GLFbo;
    private gl: WebGLRenderingContext;

    constructor(gl: WebGLRenderingContext, f0: GLFbo, f1: GLFbo) {
        this.gl = gl;
        this._current = f0;
        this._buffer = f1;
    }

    get current(): GLFbo {
        return this._current;
    }

    get buffer(): GLFbo {
        return this._buffer;
    }

    public bindFrameBuffer() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._buffer.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._buffer.texture, 0);
    }

    swap(): void {
        let f = this._current;
        this._current = this._buffer;
        this._buffer = f;
        /*[this._current,this._buffer]=[this._buffer,this._current];*/      // fixme:ES6写法，但这个貌似没第一种快
    }
}

export class GLProgram {

    private gl: WebGLRenderingContext;

    private _uniform: UniformObject;

    private _attribute: AttributeObject;

    private _program: WebGLProgram;

    constructor(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
        this.gl = gl;
        this._uniform = {};
        this._attribute = {};
        const program = gl.createProgram();
        if (!program) throw "program is null!";
        this._program = program;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw gl.getProgramInfoLog(program);
        const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const activeUniform: WebGLActiveInfo | null = gl.getActiveUniform(program, i);
            if (activeUniform) {
                const name = activeUniform.name;
                const uniform = gl.getUniformLocation(program, name);
                if (uniform != null)
                    this._uniform[name] = uniform as number;
            }
        }
        const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < attributeCount; i++) {
            const activeAttribute = gl.getActiveAttrib(program, i);
            if (activeAttribute) {
                const name = activeAttribute.name;
                const attribute = gl.getAttribLocation(program, name);
                if (attribute != null)
                    this._attribute[name] = attribute as number;
            }
        }
    }

    use(): void {
        this.gl.useProgram(this._program);
    }

    get uniform(): UniformObject {
        return this._uniform;
    }

    get attribute(): AttributeObject {
        return this._attribute;
    }

    get program(): WebGLProgram {
        return this._program;
    }
}

export interface BufferObject {
    [index: string]: WebGLBuffer;
}

export interface UniformObject {
    [index: string]: number
}

export interface AttributeObject {
    [index: string]: number
}