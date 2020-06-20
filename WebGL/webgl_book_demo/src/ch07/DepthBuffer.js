// DepthBuffer.js (c) 2012 matsuda
// fixme:隐藏面消除:帮助消除那些被遮挡的表面,而不必考虑各物体在缓冲区中的顺序,步骤如下:
// fixme:(1)开启隐藏面消除功能:gl.enable(gl.DEPTH_TEST)
// fixme:(2)在绘制之前,清除深度缓冲区:gl.clear(gl.DEPTH_BUFFER_BIT);
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'uniform mat4 u_mvpMatrix;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_mvpMatrix * a_Position;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Set the vertex coordinates and color (the blue triangle is in the front)
  var n = initVertexBuffers(gl);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // Enable depth test
  // fixme:(1)开启隐藏面消除功能
  // fixme:gl.enable(cap):开启cap表示的功能
  // fixme:cap=gl.DEPTH_TEST时,代表隐藏面消除
  // fixme:cap=gl.BLEND时,代表混合(参见第九章层次模型)
  // fixme:cap=gl.POLYGON_OFFSET_FILL时,代表多边形位移
  // fixme:更多参数见
  // fixme:gl.disable(cap):表示关闭cap表示的功能
  gl.enable(gl.DEPTH_TEST);

  // Get the storage location of u_mvpMatrix
  var u_mvpMatrix = gl.getUniformLocation(gl.program, 'u_mvpMatrix');
  if (!u_mvpMatrix) {
    console.log('Failed to get the storage location of u_mvpMatrix');
    return;
  }

  var modelMatrix = new Matrix4(); // Model matrix
  var viewMatrix = new Matrix4();  // View matrix
  var projMatrix = new Matrix4();  // Projection matrix
  var mvpMatrix = new Matrix4();   // Model view projection matrix

  // Calculate the view matrix and the projection matrix
  modelMatrix.setTranslate(0.75, 0, 0);
  viewMatrix.setLookAt(0, 0, 5, 0, 0, -100, 0, 1, 0);
  projMatrix.setPerspective(30, canvas.width/canvas.height, 1, 100);
  // Calculate the model view projection matrix
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  // Pass the model view projection matrix
  gl.uniformMatrix4fv(u_mvpMatrix, false, mvpMatrix.elements);

  // Clear color and depth buffer
  // fixme:(2)在绘制任意一帧之前,都必须清除深度缓冲区,以消除绘制上一帧时在其中留下的痕迹,如果不这样做,就会出现错误的结果
  // fixme:清除多个缓冲区用|分隔
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.drawArrays(gl.TRIANGLES, 0, n);   // Draw the triangles

  // Prepare the model matrix for another pair of triangles
  modelMatrix.setTranslate(-0.75, 0, 0);
  // Calculate the model view projection matrix
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  // Pass the model view projection matrix to u_MvpMatrix
  gl.uniformMatrix4fv(u_mvpMatrix, false, mvpMatrix.elements);

  gl.drawArrays(gl.TRIANGLES, 0, n);   // Draw the triangles
}

function initVertexBuffers(gl) {
  var verticesColors = new Float32Array([
    // Vertex coordinates and color
     0.0,  1.0,   0.0,  0.4,  0.4,  1.0,  // The front blue one
    -0.5, -1.0,   0.0,  0.4,  0.4,  1.0,
     0.5, -1.0,   0.0,  1.0,  0.4,  0.4,

     0.0,  1.0,  -2.0,  1.0,  1.0,  0.4, // The middle yellow one
    -0.5, -1.0,  -2.0,  1.0,  1.0,  0.4,
     0.5, -1.0,  -2.0,  1.0,  0.4,  0.4,

     0.0,  1.0,  -4.0,  0.4,  1.0,  0.4, // The back green one
    -0.5, -1.0,  -4.0,  0.4,  1.0,  0.4,
     0.5, -1.0,  -4.0,  1.0,  0.4,  0.4,
  ]);
  var n = 9;

  // Create a buffer object
  var vertexColorbuffer = gl.createBuffer();
  if (!vertexColorbuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  // Write vertex information to buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorbuffer);
  gl.bufferData(gl.ARRAY_BUFFER, verticesColors, gl.STATIC_DRAW);

  var FSIZE = verticesColors.BYTES_PER_ELEMENT;
  // Assign the buffer object to a_Position and enable the assignment
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if(a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return -1;
  }
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, FSIZE * 6, 0);
  gl.enableVertexAttribArray(a_Position);
  // Assign the buffer object to a_Color and enable the assignment
  var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_Color < 0) {
    console.log('Failed to get the storage location of a_Color');
    return -1;
  }
  gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE * 6, FSIZE * 3);
  gl.enableVertexAttribArray(a_Color);

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return n;
}