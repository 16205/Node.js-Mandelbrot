
# Node.js-Mandelbrot
## Introduction
This project is an implementation of a load balanced Mandelbrot set rendering server. It uses the cluster module of Node.js to create multiple worker processes that can handle requests in parallel. The master process is responsible for distributing tasks to the workers and receiving their results, while the workers handle the computation of the Mandelbrot set.

The server accepts HTTP requests from the client, which can either be for the interface or for rendering data of the Mandelbrot set. When the client requests the interface, the master process serves it directly. When the client requests data, the master process delegates the task to a worker process in a round-robin fashion, and sends the result back to the client.

## Running the Server
To start the server, run the following command in the terminal:
```
npm start
```
This will start the master process and the worker processes. The server will be listening on port 4001 for client requests.

There is no need to `npm install`, as it only depends on `fs`, `cluster` and `http` modules.
### Using the Client
To use the client, open a web browser and go to http://localhost:4001. This will bring up the interface for rendering the Mandelbrot set. The interface allows the user to enter **x** and **y** value which the picture will be centered on, as well as a **zoom** and a **resolution** value of the image of the set. The rendering is done in real time, as the user interacts with the interface.

## Load Balancing
The load balancing in this project is implemented in the master process. When a client request for data comes in, the master process selects the next available worker in a round-robin fashion and sends the task to it, using the `worker.send({})` method. This ensures that the workload is evenly distributed among the worker processes.
The master process then waits for the answer message of the worker, thanks to the `cluster.on('message', (worker, message => {})` method call. The code inside the function block then sends back the response to the client, using the `response.write()` method.

## Client-backend API

### Client (script.js)
The client is a JavaScript file, "script.js" that runs in the user's web browser. It sends HTTP requests to the backend and handles the responses. It communicates with the backend through HTTP requests to the `localhost:4001` endpoints specified in the "url" variable. The client makes four parallel requests, each with a different "id" parameter, to the backend endpoint specified in "url".

#### HTTP Request
Here is what a HTTP GET request to the backend looks like:

```
GET /mandelbrot?x=<x coordinate>&y=<y coordinate>&zoom=<zoom level>&size=<image size>
```
The x and y parameters specify the center point of the Mandelbrot set being rendered. The zoom parameter specifies the zoom level, with higher values corresponding to more zoomed in images. The size parameter specifies the size of the image in pixels.

#### HTTP Response
The backend responds with an HTTP response of type text/event-stream containing the image data. The image data is sent in chunks, with each chunk containing a chunk of the image data.

### Backend (worker.js and master.js)

The backend is a Node.js server that runs on the server hosting the website. It receives HTTP requests from the client, performs the necessary computation to generate the Mandelbrot set image, and sends the image data back to the client.

The backend, "master.js", receives these requests and serves the client with an HTTP response in the form of a continuous stream of data. The master forwards the request to the workers which process the request by parsing the parameters included in the request URL, performing calculations on the Mandelbrot set, and sends the resulting data back to the master, which forwards it back to the client as a message in the HTTP response stream. The backend will continue to send messages to the client as long as the stream remains open.

The client listens for these messages and processes them by updating the rendering of the Mandelbrot set on the client side, with the `render()` method present in "script.js", which is the client script. 
The client can also send a request to close the stream by closing the connection. The backend will stop sending messages and close the stream in response to this request.

#### HTTP Request
The backend receives an HTTP GET request from the client in the following format:


```
GET /mandelbrot?x=<x coordinate>&y=<y coordinate>&zoom=<zoom level>&size=<image size>
```
#### HTTP Response
The backend sends an HTTP response of type text/event-stream to the client containing the image data. The image data is sent in chunks, with each chunk containing a chunk of the image data.

----

![Screenshot](https://github.com/sezanzeb/Node.js-Mandelbrot/raw/master/mandelbrot.png)
