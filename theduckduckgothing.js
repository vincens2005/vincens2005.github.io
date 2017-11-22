/* 
 * Copyright (c) 2010, Dhruv Matani
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

(function($) {
  var jQuery = $;
  var dparams = {
    unpunct: false, /* (true/false) Remove punctuations from the selected 
      text if true. Default: false
    */
    "max-length": 60, /* Ignore selected text if number of selected characters 
    are greater than max-length. Default: 60
    */
    singleton: false, /* (true/false) Will allow ONLY 1 instance of this widget on 
      this page if set to true. The value of 'singleton' must be the SAME
      for ALL invocations of this widget on the same page. The behaviour of 
      the widget is undefined if you use different paramaters when invoked 
      on the same page. Default: false
    */
    clickout: false, /* (true/false) Clicking outside the widget closes it if true.
      The value of clickout is meaningful ONLY if the 'singleton' flag is 
      set to true. Default: false
    */
    proximity: true, /* (true/false) If true, changes the opacity of the widget 
      based on widget position and the position of the mouse pointer. The value 
      of proximity holds true only if singleton is set to true. If 
      'proximity' is set to true and 'singleton' is set to false, 
      then the behaviour of this widget can not be defined. Just like 
      'singleton', if you specify a value for 'proximity' once on a page, 
      you MUST use the same value on all invocations on that page.
      Default: true
    */
    cornered: true, /* (true/false). If true, the widget will try to start 
      itself at one of the corners of the screen such that it is not under 
      the mouse. sandesh247 suggested this since most selections would be
      to copy text and not to define a term. Thanks Sandy!! :-) :-)
      Default: true
    */
    "error-string": "Sorry, nothing could be found :-(", /* The error string to 
      display in the iframe if no matches were found.
    */
	  css: { }, /* Other css attributes. 
      The attributes that are forwarded (if using iframe) are: color, font-faimly.
      By default, color and font-family are copied from the element that has 
      been made zero_clickable. 
      Default: (empty)
	  */
    onbeforeshow: function() { }, /* Function to be called just before the widget 
      is shown.
    */
    onbeforeclose: function() { } /* Function to be called just after the close
      button on the widget is clicked, but before the widget is removed. 
      Note: This callback will NOT be fired if the widget is removed due to any
      event other than the user clicking the close button.
    */
  };

  var divstr = "<div class='actions'>" +
  "<table border='0' width='100%'><tr>" +
  "<td class='left-td'>" +
  "  <div class='user-sel-text'>Hello World</div>" + 
  "</td>" + 
  "<td class='right-td'>" + 
  "  <div class='close'>X</div>" + 
  "</td>" +
  "</tr><tr><td class='more-info-td' colspan='2'><a class='more-info'>More Info.</a></td></tr></table>" + 
  "" + 
  "</div>";
  var prev_open = null;
  var last_click_at = (new Date()).getTime();
  var last_mousedown = null;

  /* Window's handlers attached? */
  var _wh = false;


  function getSelected() {
    if(window.getSelection) { return window.getSelection(); }
    else if(document.getSelection) {
      return document.getSelection();
    }
    else {
      var selection = document.selection && document.selection.createRange();
      if(selection.text) {
        return selection.text;
      }
      return false;
    }
    return false;
  }

  function remove_prev_open() {
    if (prev_open) {
      prev_open.remove();
      prev_open = null;
    }
  }

  function unpunct(s) {
    return jQuery.trim((s.replace(/[\W]/g, " ")).replace(/[\s]+/g, " "));
  }

  function clickedOnMe(x, y, p, act, e) {
    return e.pageX >= x-p && e.pageX <= x+act.width()+2*p && 
      e.pageY >= y-p && e.pageY <= y+act.height()+2*p;
  }


  /* Get the LEFT (x) & TOP (y) values for placing the new widget 
   * div on the screen.
   *
   * Parameters:
   * e => The event object that will give the current mouse position
   * a => The new widget div that is going to be shown.
   *
   * Returns { x: x-value, y: y-value }. The x & y positions for the
   * widget to be placed.
   *
   */
  function get_div_start_pos(e, a) {
    var x = parseInt(a.css("left"));
    var y = parseInt(a.css("top"));

    // console.log("get_div_start_pos::e:", e);

    var p = 13;
    var widw = a.width() + 2*p;
    var widh = a.height() + 2*p + 200;
    var winw = $(window).width();
    var winh = $(window).height();
    var otop = $(window).scrollTop();
    var MAGIC = 20;

    /* List of candidate positions */
    var _candidates = [ 
      { x: winw - MAGIC - widw, y: otop + MAGIC }, /* Top Right */
      { x: winw - MAGIC - widw, y: otop + winh - widh - MAGIC }, /* Bottom Right */
      { x: MAGIC, y: otop + MAGIC }, /* Top Left */
      { x: MAGIC, y: otop + winh - widh - MAGIC } /* Bottom Left */
    ];

    // console.log("_candidates:", _candidates);

    for (var i in _candidates) {
      var _c = _candidates[i];
      // console.log(clickedOnMe(_c.x, _c.y, 13, a, e));
      if (!clickedOnMe(_c.x, _c.y, 13, a, e)) {
        return _c;
      }
    }
    /* We failed to find a position!!!! */
    return { x: x, y: y };

  } // get_div_start_pos()


  /* We define a mouseup on the document object since the user may have 
   * selected some text and may 'mouseup' on an element that is not in 
   * the list of elements being watched for mouseup.
   */
  $(document).mouseup(function(e) {
    // alert(last_mousedown);
    if (last_mousedown) {
      /* This (_tmp) is to ensure that recirsive bubbling of events
       * doesn't make the browser go into a tizzy!!
       */
      var _tmp = last_mousedown;
      last_mousedown = null;
      $(_tmp).trigger("mouseup", [e]);
    }
  });

  /* Our plug-in's entry point */
  jQuery.fn.zero_clickable = function(params) {

    params = jQuery.extend({}, dparams, params);
    // console.log("PARAMS Clickout:", params.clickout);

    if (!_wh && (params.proximity || params.clickout)) {
      _wh = true;

      if (params.proximity) {

        $(document).mousemove(function(e) {
          var a = $(".actions");
          // console.log(a);
          a.each(function() {
            /* To account for the padding and border width */
            var p = 13;
            var i = $(this);
            var x = parseInt(i.css("left"));
            var y = parseInt(i.css("top"));
            var cx = x + (i.width() / 2.0);
            var cy = y + (i.height() / 2.0);
            var dx = Math.abs(cx - e.pageX);
            var dy = Math.abs(cy - e.pageY);

            var d = Math.sqrt(dx*dx + dy*dy);
            // console.log("A", $(i).css("left"));
            var _o = 1.0;
            // console.log(x-p, y-p, i.width()+p, i.height()+p, e.pageX, e.pageY);
            if (clickedOnMe(x, y, p, i, e)) {
              /* Do nothing */
            }
            else {
              if (d < 1000) {
              _o = 1.0 - ((d - 100) / 1000.0);
               // console.log(d);
              } else { _o = 0.0; }
            }
            _o = _o < 0.15 ? 0.15 : _o;
            i.css("opacity", _o);
          });

        }); // $(window).mousemove(function(e)

      } // if (params.proximity)

      if (params.clickout) {
        $(document).click(function(e) {
          // alert("document.click");
          var curr_click_time = (new Date()).getTime();
          var prev_click_time = last_click_at;
          last_click_at = curr_click_time;

          // console.log("LCA:", last_click_at);
          // console.log("selected text: ", getSelected());
          // console.log("Times:", curr_click_time, prev_click_time, curr_click_time - prev_click_time);

          if (curr_click_time - prev_click_time < 500) {
            return;
          }

          var a = $(".actions");

          /* Did someone click on an action div?? */
          var onAction = false;

          a.each(function() {
            if (onAction) {
              return;
            }

            /* To account for the padding and border width */
            var p = 13;
            var i = $(this);
            var x = parseInt(i.css("left"));
            var y = parseInt(i.css("top"));

            if (clickedOnMe(x, y, p, i, e)) {
              onAction = true;
            }
          });

          if (!onAction) {
            remove_prev_open();
          }

        }); // $("body").click(function(e)

      } // if (params.clickout)

    } // if (!_wh)


    $(this).each(function() {

      /* We monotor mousedown events on the selected object since
       * we would like to know the element under consideration if 
       * the user mouseups on a non-selected element.
       */
      $(this).mousedown(function(e) {
        // alert("bar");
        last_mousedown = this;
      });

      $(this).mouseup(function(e) {
        // console.log("MOUSEUP");
        // console.log(getSelected());
        last_mousedown = null;

        /* This is in the mouseup handler since the page's CSS may change
         * any time, and we always try to mimic it if nothing is specified
         */
        var _p = jQuery.extend({}, params);
        _p.css = jQuery.extend({}, _p.css);
        _p.css = jQuery.extend({
          "font-family": $(this).css("font-family"), 
          "color":       $(this).css("color")
        }, params.css);

        var sobj = getSelected();

        var st = sobj ? jQuery.trim(sobj.toString()) : "";
        if (params.unpunct) {
          st = unpunct(st);
        }
        if (st.length == 0 || st.length > params["max-length"]) {
          return;
        }

        /* Popup a div with certain actionable items */
        var a = $(divstr);
        a.css("left", e.pageX)
         .css("top", e.pageY)
		 .css("position", "absolute");
        if ("id" in params) {
          a.attr("id", _p.id);
        }
        a.find(".user-sel-text").html(st);
        a.find("iframe").remove();

        a.draggable();
        $("body").append(a);

        /* Check if we are in singleton mode */
        if (params.singleton) {
          remove_prev_open();
          prev_open = a;
        }

        if (params.cornered) {
          // console.log("mouseup::e:", e);
          var _dp = get_div_start_pos(e, a);
          // console.log("_dp:", _dp);
          a.css("left", _dp.x.toString() + "px")
           .css("top",  _dp.y.toString() + "px");
        }

        for (var k in _p.css) {
          // console.log("Setting css[", k, "] to: ", params.css[k]);
          a.css(k, _p.css[k]);
        }

        /* Display it!! */
        try {
          params.onbeforeshow(a);
        }
        catch (e) { /* Do nothing */ }
        a.show();

        /* Since this is a text selection, we fake a click. This is done to 
         * make the time differences match up.
         */
        last_click_at = (new Date()).getTime();


        /* All the event handlers go below */

        a.find(".more-info").click(function() {
          /* Remove an existing iframe if one exists */
          if (a.find("iframe").length > 0) {
            return;
          }

		  $(this).animate({ opacity: 0.0 }, 500, function() {
			  $(this).css("visibility", "hidden");
		  });

          var i = $("<iframe></iframe>");
          /* To please IE */
          i.attr("frameBorder", "0")
           .css("background-color", "transparent");
          var q = a.find(".user-sel-text").text();

          var url = "http://dhruvbird.com/ddb/zeroclick.php?color=" + escape(_p.css.color) + 
            "&font-family=" + escape(_p.css["font-family"]) + 
            "&q=" + escape(q);
          i.attr("src", url);
          a.append(i);
        }); // $(this).find(".more-info").click

        a.find("div.close").click(function() {
          /* Remove the .actions div */
          try {
            params.onbeforeclose(a);
          }
          catch (e) { /* Do nothing */ }
          a.remove();
        });

        a.mousemove(function() {
          // console.log("AA");
          $(this).css("opacity", 1.0);
        });

      }); // $(this).mouseup

    }); // $(this).each

  };
}(jQuery))
