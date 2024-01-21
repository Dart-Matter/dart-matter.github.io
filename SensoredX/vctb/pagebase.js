/*
    Prevent the optimizer from removing these functions.
*/
window['gotopage'] = gotopage;

/*-----------------------------------------------------------------------------

    Request the book to navigate to the specified page.
*/
function gotopage(pagename)
{
    target = window.parent.document.getElementById('idGestureLayer');
    target.setAttribute("targetPage", pagename);
    
    evt = document.createEvent("Event");
    evt.initEvent("GotoPage", true, true);
    target.dispatchEvent(evt);
}
