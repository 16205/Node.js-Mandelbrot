let fs = require('fs')
let http = require("http")

function decodeGetParams(url) {
    // Get the params without the address
    url = url.split("?")[1] 

    // If there are no params, return an empty object
    if(url == undefined) {
        return {}
    }

    // Transform url to an array with all the params
    let strParams = url.split("&") 

    let params = {}
    let i 
    // Iterate over the array with the parameters (each element looks like "asdf=bla")
    for(i = 0; i < strParams.length; i ++) {
        let strParam = strParams[i].split("=")
        params[strParam[0]] = strParam[1]
    }

    return params
}

function parseUrl(path)
{
    // console.log(path)
    // Get parameters from the url
    let params = decodeGetParams(path)
    let zoom = parseFloat(params.zoom)
    let minX = parseFloat(params.x)-(1/zoom)
    let maxX = parseFloat(params.x)+(1/zoom)
    let minI = parseFloat(params.y)-(1/zoom)
    let maxI = parseFloat(params.y)+(1/zoom)
    let size = parseInt(params.size) //known as "size" client side
    let width = Math.abs(maxX-minX)
    let height = Math.abs(maxI-minI)
    let id = parseInt(params.id)

    let mbAnswer = {
        "maxX": maxX,
        "maxI": maxI,
        "minX": minX,
        "minI": minI,
        "width": width,
        "height": height,
        "zoom": zoom,
        "length": 0,
        "requestcount": 0,
        "points":[] // Points that changed (diverged) go here
    }

    return {mbAnswer,size,id}
}

function initializeMB(state,mbAnswer,size)
{
    let width = Math.abs(mbAnswer.maxX-mbAnswer.minX)
    let height = Math.abs(mbAnswer.maxI-mbAnswer.minI)
    let stepI = height/size
    let stepX = width/size
    let pointsInUse = 0

    //check if this loop will ever come to an end. An issue that might be the case for very large zoom factors
    if(1-stepX == 1)
        return -1

    state.allPointsC = new Array(size*size)
    state.allPointsZ = new Array(size*size)
    state.allPointsPx = new Array(size*size)

    //each item inside answer.points will get a unique identifier
    let pointNr = 0

    //iterate over each point in the visible coordinate system
    let ci = mbAnswer.maxI
    let cx = 0
    while(ci >= mbAnswer.minI)
    {
        cx = mbAnswer.maxX
        while(cx >= mbAnswer.minX)
        {
            //it will leave out 2 circles that are known to remain black
            if((cx+0.35)*(cx+0.35)+(ci*ci) > 0.14)
            if((cx+1)*(cx+1)+(ci*ci) > 0.04)
            //if((cx*cx)+(ci*ci) <= 4)
            {
                //add every point (except those inside the two circles) to state.allPoints
                state.allPointsC[pointNr] = [
                    cx, //will remain the same all the time
                    ci  //except that point diverges. then undefined will be assigned to it
                ]
                state.allPointsZ[pointNr] = [
                    cx, //this is not redundant. it's zx and zi actually
                    ci  //this array tuple is going to be overwritten with iteration results
                ]
                pointsInUse ++
            }

            //the array index
            pointNr += 1

            //go to next pixel
            cx -= stepX
        }
        //go to next line
        ci -= stepI
    }
    return 1
}

function requestMB(state,mbAnswer,size)
{
    // Index inside the array that is being sent to the client
    let divergedPointsCount = 0

    // Go through all points, they are initialized in initializeMB()
    let pointNr
    let zx
    let zi
    let dist
    let zj
    for(pointNr = 0;pointNr < state.allPointsC.length;pointNr ++)
    {
        // Only points that did not diverge
        if(state.allPointsC[pointNr] != undefined)
        {
            // Do a Mandelbrot iteration
            zx = state.allPointsZ[pointNr][0]
            zi = state.allPointsZ[pointNr][1]
            dist = Math.abs(Math.pow(zx,2)+Math.pow(zi,2))

            //check if this point diverges or not
            if(dist < 4) //does not converge //pythagoras squared (no sqrt)
            {
                //then do an iteartion. next time the server will check wether or not this diverges (dist larger than two)
                //allPointsC holds the points from the last requestMB call
                zj = zi //store old zi value in zj, because...
                zi = 2*zx*zi + state.allPointsC[pointNr][1] //...zi is going to be overwritten now...
                zx = zx*zx - zj*zj + state.allPointsC[pointNr][0] //...but needs to be here for one more calculation

                //state.allPointsZ holds the information for the server needed to calculate the fractal
                state.allPointsZ[pointNr][0] = zx
                state.allPointsZ[pointNr][1] = zi
            }
            else //converges
            {
                //put this point into mb_answer.points
                //the sever will send only those points that just diverged in the most recent iteration
                state.allPointsPx[divergedPointsCount] = [
                    parseFloat((state.allPointsC[pointNr][0] - mbAnswer.minX)*size/mbAnswer.width).toFixed(0),
                    parseFloat((state.allPointsC[pointNr][1] - mbAnswer.minI)*size/mbAnswer.height).toFixed(0)
                ]

                divergedPointsCount ++

                //mark this point as "diverged". The loop will leave out points that are known to diverge
                state.allPointsC[pointNr] = undefined
            }
        }
    }

    //take slice from state.allPointsC and store it inside mb_answer
    mbAnswer.points = state.allPointsPx.slice(0,divergedPointsCount)
    mbAnswer.length = divergedPointsCount
}

process.on('message', message =>
{
    //understand the request
    let path = message.data
    console.log('Received request '+path)
    // Create empty answer
    let answer = ""

    //get some parameters, initialize stuff
    let calculateTime = new Date().getTime()
    let parsed = parseUrl(path)
    let mbAnswer = parsed.mbAnswer
    let id = parsed.id
    let state = {}
    state.allPointsC = []
    state.allPointsZ = []
    state.allPointsPx = []

    //initialize all the points that are going to be iterated. returns the amount of points
    let zoomfactorvalid = initializeMB(state,mbAnswer,parsed.size)
    if(zoomfactorvalid == -1)
    {
        console.log("the zoom factor is too large")
        process.send({ message: "id:"+id+"\n"+"data: zoomfactorinvalid\n\n"})
        // response.write("id:"+id+"\n")
        // response.write("data: zoomfactorinvalid\n\n")
        // response.end()
        return
    }

    //as long as the client is active, iterate the points, that initializeMB created
    //this interval writes the stream. It's an interval and not a while loop because it has to be asynchronous and non blocking to some degree
    let requestcount = 0
    
    if(path.indexOf('/mandelbrot') == 0)
    {
        let interval = setInterval(function()
        {
            requestMB(state,mbAnswer,parsed.size)
            if(mbAnswer.points.length > 0)
            {
                mbAnswer["requestcount"] = requestcount
                calculateTime = new Date().getTime()
                answer = JSON.stringify(mbAnswer)
                // response.write("id:"+id+"\n")
                // response.write("data:"+answer+"\n\n")
                process.send({ message: "id:"+id+"\n"+"data:"+answer })
                // console.log('Sent processed response to request '+path)
                mbAnswer.points = []
                requestcount ++
            }
            else
            {
                //if no point has been found within 5 seconds, close the stream
                if(new Date().getTime() - calculateTime > 5000)
                {
                    clearInterval(interval);
                    console.log("no more points found for stream id: "+id)
                    //free up memory
                    state = {}
                    mbAnswer = {}
                    // response.end()
                }
            }
        },1)

    }
    else if(path.indexOf('/stop') == 0) 
    {
        clearInterval(interval);
        console.log("client closed stream id: "+id)
        //free up memory
        state = {}
        mbAnswer = {}
    }
    
})

