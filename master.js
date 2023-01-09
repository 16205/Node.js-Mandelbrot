let fs = require('fs')
let http = require("http")
let cluster = require("cluster")

let counter = 0;

let server = http.createServer(function(request, response)
{
    // Understand the request
    let path = request.url
    
    // If client requests interface, serve it
    if(path.indexOf("/mandelbrot") == -1)
    {
        if(path == "/")
        path = "/index.html"
        console.log("request for "+path)
        // Serve frontend
        if (fs.existsSync("public"+path)) {
            let html = fs.readFileSync("public"+path,"utf-8").toString()
            response.writeHead(200, {"Content-Type": "text/html"})
            answer = html
        }
        
        // Send answer to client
        response.end(answer)
    }
    
    // If client requests mandelbrot data, delegate computation to workers
    else if(path.indexOf("/mandelbrot") == 0)
    {
        // Get the next worker
        const worker = cluster.workers[Object.keys(cluster.workers)[counter]];
        // console.log('Next worker selected: '+worker.id)
        console.log("request for "+path)

        // Send the task to the worker
        worker.send({ type: 'message', data: path});
        console.log('Task sent to worker '+worker.id);

        response.writeHead(200, {"Content-Type":"text/event-stream", "Cache-Control":"no-cache", "Connection":"keep-alive"})
        response.write('\n\n');

        // Increment the counter
        counter = (counter + 1) % Object.keys(cluster.workers).length;
    }     

    cluster.on('message', (worker, message) => {
        
        const parts = message.message.split('\n');
        const id = parts[0];
        const data = parts[1];
        // console.log('received answer from worker '+worker.id);
        response.write(id+'\n');
        response.write(data+'\n\n');
        // response.end()
        request.connection.addListener("close", function ()
        {
            // console.log("client requests to close stream id: "+id)
            worker.send({ type: 'message', data: '/stop'})
            response.end()
        }, false);

    }); 

})

//wait for requests
let port = 4001
server.listen(port)
console.log("listening on port "+port+"...")