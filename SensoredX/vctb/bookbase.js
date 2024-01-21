var ANIMSLIDEDURATION = 1250;
var ANIMFADEDURATION = 750;
var MASKFADEDURATION = 250;
var GESTURESURFACE = "#idGestureLayer";
var GESTUREDETECTTHRESHOLD = 40;
var GESTURETOLERANCE = 80;
var GESTUREUPLIMIT = 80;
var GESTUREDOWNLIMIT = 400;
var GESTUREHORIZONTALLIMIT = 80;
var GESTUREUP = "u";
var GESTUREDOWN = "d";
var GESTUREHORIZONTAL = "h";
var GESTURENONE = "";
var PAGEDESIGNWIDTH = 800;
var PAGEMINHORIZONTALMARGIN = 400;
var ACTIONNEXT = "Next";
var ACTIONPREVIOUS = "Previous";
var ACTIONUP = "Up";
var ACTIONDOWN = "Down";

var pageWidth = 0;
var pageCurrent = -1;
var pageHorizontalMargin = 0;
var gestureStartX = -1;
var gestureStartY = 0;
var gestureDirection;
var canAnimate;
var animBusy = false;
var animLastTick = -1;
var animLastVector = -1;
var animVelocity;
var windowWidth;

var onFlick;
var onFlickProgress;

/*
    This is a way of importing functions into pages without 
    each page explicitly importing this script file.
*/
window['OnGotoPage'] = OnGotoPage;
window['OnKey'] = OnKey;
window['OnDoubleClick'] = OnDoubleClick;
window['InitBook'] = InitBook;


/*-----------------------------------------------------------------------------

    Performs first time initialization of the book.
    Intended to be called by the master document's onLoad event.
*/
function InitBook()
{
    InitSize();
    LoadFirstPage();
    InitGesture();
    $("#idBook").focus();
    NavigateTo(0,0);
}

/*-----------------------------------------------------------------------------

    Loads a single page into the document hierarchy.
*/
function PreloadPage(index)
{
    if (pages[index][PAGE_LOADED] == 0)
    {
        pageId = 'divPage' + index;
        $("#idBookEnd").before(
            '<div id="' + pageId + '" class="pageFrameFloater" style="left:' + pageWidth * index + 'px; width:' + pageWidth + 'px">' +
                '<iframe src="' + pages[index][PAGE_FILE] + '" scrolling="no" class="pageFrame" >' +
                '</iframe>' +
            '</div>');
        
        pages[index][PAGE_LOADED] = 1;
    }
}

/*-----------------------------------------------------------------------------

    Loads a page and its two neighboring pages if there are any.  The first
    and last pages have only one neighbor.  This only loads the pages.  It
    does not scroll them into view if they aren't visible.
    
    This prepares the pages so that the neighbors can be scrolled into view
    from the middle page.
*/
function LoadPageAndNeighbors(index)
{
    // Preceding page
    if (index > 0)
        PreloadPage(index-1);
    
    // Middle page    
    PreloadPage(index);
    
    // Following page
    if ((index + 1) < pages.length)
        PreloadPage(index+1);
}

/*-----------------------------------------------------------------------------

    Load the title page.
*/
function LoadFirstPage()
{
    LoadPageAndNeighbors(0);
    pageCurrent = 0;
}

/*-----------------------------------------------------------------------------

    Install the window size change detector and initialize everything and
    updates the book state with the current window size.
*/
function InitSize()
{
    window.addEventListener("resize", function() {OnResize();}, true);
    OnResize();
}

/*-----------------------------------------------------------------------------

    Turn on the gesture capture layer.
*/
function InitGesture()
{
    //Stops the default gesture behavior on Android browser
    document.addEventListener("touchstart", function(e){
        e.preventDefault();
    }, false);

    // Place the gesture layer on top of everything.
    $("#idBook").after('<div id="idGestureLayer"></div>');
    
    // Install the various user input handlers.
    
    onFlick = FlickHandler;
    onFlickProgress = FlickProgressHandler;
    
    $(GESTURESURFACE).on('mousedown', OnStartGesture);
    $(GESTURESURFACE).on('dblclick', OnDoubleClick);
    
    // IPC used by pages to send page navigation requests back to us.
    $(GESTURESURFACE).on('GotoPage', OnGotoPage);
    $(document).on('keydown', OnKey);
}

/*-----------------------------------------------------------------------------

    Gets the pages[] index of the page with the specified name.
*/
function PageIndexFromName(name)
{
    retVal = 0;
    
    pages.forEach(function(val, idx, arr)
    {
        if (val[PAGE_NAME] == name) retVal = idx;
    });
    
    return retVal;
}

/*-----------------------------------------------------------------------------

    Called when the window size changes to adjust the book element dimensions.
*/
function OnResize()
{
    pageHorizontalMargin = 0;
    
    windowWidth = $(window).width();
    if (windowWidth < (PAGEDESIGNWIDTH + PAGEMINHORIZONTALMARGIN))
    {
        pageHorizontalMargin = (PAGEDESIGNWIDTH + PAGEMINHORIZONTALMARGIN - windowWidth) / 2;
    }
    
    pageWidth = windowWidth + 2*pageHorizontalMargin;
    $(".pageFrameFloater").css({width: pageWidth}); // Resize all page widths.
    $("#idBook").width( pageWidth * pages.length ); // Resize book width.
    
    // Reposition all pages
    pages.forEach(function(val, idx, arr)
    {
        $("#divPage"+idx).css({left: pageWidth * idx});
    });
   
    // Reposition the view so that the new window is centered over the current page.
    if (pageCurrent > -1)
        $("#idBook").css({left: -($("#divPage" + pageCurrent).position().left + pageHorizontalMargin)}); // Reposition book.
}

/*-----------------------------------------------------------------------------

    Called when the touch position changes while a touch is down.
*/
function OnGestureMove(event) 
{
    if (gestureStartX != -1) 
    {
        x2 = event.clientX;
        y2 = event.clientY;
        tic = new Date().getMilliseconds();
        vec = Math.sqrt((x2 - gestureStartX) * (x2 - gestureStartX) + (y2 - gestureStartY) * (y2 - gestureStartY));

        if (animLastTick != -1) 
        {
            animVelocity = Math.min(15, Math.abs(vec - animLastVector) / (tic - animLastTick + 0.001));
        }
        
        animLastTick = tic;
        animLastVector = vec;

        if (gestureDirection == GESTURENONE) 
        {
            if (gestureStartY - y2 > GESTUREDETECTTHRESHOLD)
                gestureDirection = GESTUREUP;
            else if (y2 - gestureStartY > GESTUREDETECTTHRESHOLD)
                gestureDirection = GESTUREDOWN;
            else if (Math.abs(x2 - gestureStartX) > GESTUREDETECTTHRESHOLD)
            {
                gestureStartX = x2;
                gestureStartY = y2;
                gestureDirection = GESTUREHORIZONTAL;
            }
            else
                return;
        }

        if (gestureDirection == GESTUREUP) 
        {
            if ((Math.abs(x2 - gestureStartX) > GESTUREDETECTTHRESHOLD) || (y2 - gestureStartY > GESTUREDETECTTHRESHOLD))
            {
                StopGesture();
                ScrollResync();
            }
            else
                canAnimate = gestureStartY - y2 > GESTUREUPLIMIT;
        }
        else if (gestureDirection == GESTUREDOWN) 
        {
            if ((Math.abs(x2 - gestureStartX) > GESTUREDETECTTHRESHOLD) || (gestureStartY - y2 > GESTUREDETECTTHRESHOLD))
            {
                StopGesture();
                ScrollResync();
            }
            else
                canAnimate = y2 - gestureStartY > GESTUREDOWNLIMIT;
        }
        else if (gestureDirection == GESTUREHORIZONTAL) 
        {
            if (Math.abs(y2 - gestureStartY) > GESTURETOLERANCE)
            {
                StopGesture();
                ScrollResync();
            }
            else 
            {
                canAnimate = Math.abs(x2 - gestureStartX) > GESTUREHORIZONTALLIMIT;
                if (onFlickProgress)
                    onFlickProgress(x2 - gestureStartX - pageHorizontalMargin);
            }
        }
    }
    
    return false;
}

/*-----------------------------------------------------------------------------

    Uncaptures the current touch operation.
*/
function OnCancelGesture(event) 
{
    StopGesture();
    ScrollResync();
    return false;
}

/*-----------------------------------------------------------------------------

    Called when the touch position has gone down.
*/
function OnStartGesture(event) 
{
    if (!animBusy)
    {
        canAnimate = false;
        gestureDirection = "";
        animVelocity = 0;
        gestureStartX = event.clientX;
        gestureStartY = event.clientY;

        $(GESTURESURFACE).on('mousemove', OnGestureMove);
        $(GESTURESURFACE).on('mouseup', OnReleaseGesture);
        $(GESTURESURFACE).on('mouseout', OnCancelGesture);
    }
    
    return false;
}

/*-----------------------------------------------------------------------------

    This event can be fired by HTML pages to request navigation to a particular
    page.  The caller must set the targetPage attribute on target object to
    convey which page they want.  pagebase.js has a gotopage() function that 
    HTML can use to invoke this.
*/
function OnGotoPage(evt) 
{
    targetPageName = evt.target.getAttribute("targetPage");
    NavigateTo(PageIndexFromName(targetPageName), 0);
}

/*-----------------------------------------------------------------------------

    Called when touch is released in order to detect flick gestures.
*/
function OnReleaseGesture(event) 
{
    if ((gestureStartX != -1) && (gestureDirection != GESTURENONE) && (canAnimate) && (onFlick)) 
    {
        toLeft = event.clientX < gestureStartX;
        StopGesture();
        
        if (gestureDirection == GESTUREUP)
            onFlick(ACTIONUP, animVelocity);
        else if (gestureDirection == GESTUREDOWN)
            onFlick(ACTIONDOWN, animVelocity);
        else if (gestureDirection == GESTUREHORIZONTAL) 
        {
            if (toLeft)
                onFlick(ACTIONNEXT, animVelocity);
            else
                onFlick(ACTIONPREVIOUS, animVelocity);
        }
        else
            ScrollResync();
    }
    else if (gestureDirection == GESTUREDOWN)
    {
        onFlick(ACTIONDOWN, animVelocity);
    }
    else
    {
        StopGesture();
        ScrollResync();
    }
    
    return false;
}

/*-----------------------------------------------------------------------------

    Processes keyboard input.
*/
function OnKey(kev) 
{
    if (!animBusy && onFlick) 
    {
        if ((kev.which == 32)||(kev.which == 39))
            onFlick(ACTIONNEXT, 1);
        else if (kev.which == 37)
            onFlick(ACTIONPREVIOUS, 1);
        else if (kev.which == 38)
            onFlick(ACTIONUP, 1);
        else if (kev.which == 40)
            onFlick(ACTIONDOWN, 1);
    }
    
    return false;
}

/*-----------------------------------------------------------------------------

    Processes double touches.
*/
function OnDoubleClick(event)
{
    if (event.pageX > (windowWidth/2))
        onFlick(ACTIONNEXT, 1);
    else
        onFlick(ACTIONPREVIOUS, 1);
    
    return false;
}

/*-----------------------------------------------------------------------------

    Triggers the appropriate behavior for the different flick gestures.
*/
function FlickHandler(type, speed)
{
    if ((type == ACTIONPREVIOUS) && (pageCurrent > 0))
    {
        NavigateTo(pageCurrent-1, speed);
    }
    else if ((type == ACTIONNEXT) && (pageCurrent < pages.length - 1))
    {
        NavigateTo(pageCurrent+1, speed);
    }
    else if (type == ACTIONDOWN)
    {
        NavigateTo(PageIndexFromName("Contents"), 10);
    }
    else
        ScrollResync();
}

/*-----------------------------------------------------------------------------

    Handles the "grabbing" of the page when a touch drag has been detected.
*/
function FlickProgressHandler(delta)
{
    currentPageOffset = $("#divPage" + pageCurrent).position().left;
    $("#idBook").css({left: -currentPageOffset + delta});
}

/*-----------------------------------------------------------------------------

    Properly aligns the page position.  Used after a slide animation to make 
    sure the final position is properly aligned.
*/
function ScrollResync()
{
    NavigateTo(pageCurrent, 10);
}

/*-----------------------------------------------------------------------------

    Moves the view to the specified page.  If the page is adjacent to the
    current page the view scrolls, otherwise it jumps straight to the target
    page.
*/
function NavigateTo(page, velocity)
{
    animBusy = true;
    
    if (Math.abs(pageCurrent - page) > 1) // Are we jumping beyond the left or right pages?
    {
        LoadPageAndNeighbors(page);
    
		pageCurrent = page;
		$("#idBook").fadeTo(ANIMFADEDURATION, 0, 
		    function() 
		    {
                $("#idBook").css({left: -($("#divPage" + page).position().left + pageHorizontalMargin)});
                $("#idBook").fadeTo( ANIMFADEDURATION, 1, function(){});
                animBusy = false;
		    });
    }
    else if (pageCurrent != page) // Slide to left or right adjacent page.
    {
        if ((typeof velocity == "number") && (velocity > 1))
            duration = (ANIMSLIDEDURATION/15) * (16-velocity);
        else
            duration = ANIMSLIDEDURATION;
      
        targetPos = $("#divPage" + page).position().left + pageHorizontalMargin;
        $("#idBook").animate(
            { left: -targetPos }, 
            duration, 
            'easeOutCubic', 
            function() 
            { 
                animBusy = false;
            });
        pageCurrent = page;
        
        LoadPageAndNeighbors(page);
    }
    else // Page didn't change.
    {
        animBusy = false;
        $("#idBook").css({left: -($("#divPage" + page).position().left + pageHorizontalMargin)});
    }
    
    // Some pages need to receive control input.  In these cases
    // we'll confine the gesture area to the bottom of the window.
    if (pages[pageCurrent][PAGE_HASCONTROLS] > 0)
    {
        $("#idGestureLayer").css("top", "75%"); // Bottom 10% of window.
    }
    else
    {
        $("#idGestureLayer").css("top", "0"); // Whole window.
    }
    
    $("#idBook").focus();
}

/*-----------------------------------------------------------------------------

    Disables touch capture.
*/
function StopGesture() 
{
    gestureStartX = -1;
    
    $(GESTURESURFACE).off('mousemove', OnGestureMove);
    $(GESTURESURFACE).off('mouseup', OnReleaseGesture);
    $(GESTURESURFACE).off('mouseout', OnCancelGesture);
}
