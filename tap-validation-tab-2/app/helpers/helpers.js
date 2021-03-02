/*
 * Useful bits of HTML
 */

const spinner = '<i class="fa fa-spinner fa-spin"></i>  ';



const clientSpinner = '<i class="fa fa-spinner fa-spin client-spin"></i>  ';
const thumbsUp = '<i class="fa fa-thumbs-up"> </i>';
const thumbsDown = '<i class="fa fa-thumbs-down"> </i>';

function disableAndSpin(id) {
    $(id).attr("disabled", true);
    $(id).html(spinner + $(id).text());
}

function enableAndRemoveSpin(id) {
    $(id).attr("disabled", false);
    $(id).html($(id).html().replace(spinner, ""));
}

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        vars[key] = value;
    });
    return vars;
}

function cleanEmail(email) {
    if (email) {
        email = email.toLowerCase();
        email = email.replace("#ext#@microsoft.onmicrosoft.com", "");
        if (email.includes("@")) {
            return email;

        } else if (email.includes("_")) {
            console.log("Going the underscore route");
            var underscoreParts = email.split("_");
            var domain = underscoreParts.pop();
            var tenantString = domain.split(".")[0];

            if (underscoreParts.length > 1) {
                email = underscoreParts.join("_") + "@" + domain;
            } else {
                email = underscoreParts[0] + "@" + domain;
            }
        }
    }

    return email;
}

function getIdToken(callback) {
    $.ajax({
        url: "/.auth/me",
        type: "GET",
        success: function (data) {
            let id_token = data[0].id_token;
            return callback(null, id_token);
        },
        error: function (xhr, textStatus, errorThrown) {
            console.log("Erorr getting /me endpoint - user probably needs to login again");
            // TODO: Silently log the user in again?
            return callback(errorThrown, null);
        }
    });
}

function ajaxRequestWithToken(method, url, params, callback) {
    function finalRequest(err, auth) {
        if (err) {
            console.log(err);
        }
        $.ajax({
            url: url,
            type: method,
            dataType: "json",
            data: params,
            beforeSend: function (request) {
                request.setRequestHeader("xsrf-token", csrf);

                // TODO: Placeholder obviously
                request.setRequestHeader("Authorization", "Bearer " + auth);

            },
            success: function (data) {
                // TODO: Most of the old code still consumes this as a string - remove this line when all data = JSON.parse(data) type lines are removed
                //data = JSON.stringify(data);

                callback(data);
            },
            error: function (xhr, textStatus, errorThrown) {
                callback(errorThrown);
            }
        });
    }

    // Include csrf in request
    let csrf = $('#_csrf').val();

    console.log(params);

    getIdToken(finalRequest);
}

var csrf;
$().ready(function () {
    csrf = $('#_csrf').val();
});

function ajaxRequest(method, url, params, callback) {
    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
            callback(xmlhttp.response);
        } else {
            console.log(xmlhttp.status);
            callback(xmlhttp.response);
        }
    };

    xmlhttp.open(method, url, true);
    //console.log("Stringified: " + JSON.stringify(params));
    xmlhttp.setRequestHeader('Content-Type', 'application/json');
    xmlhttp.send(JSON.stringify(params));
}

function fixLineBreak() {
    /* 
     * Fix the line breaks generated in a contenteditable
     */
    var sel, range;
    if (window.getSelection) {
        // IE9 and non-IE
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            range = sel.getRangeAt(0);
            range.deleteContents();

            // Range.createContextualFragment() would be useful here but is
            // only relatively recently standardized and is not supported in
            // some browsers (IE9, for one)
            var el = document.createElement("div");
            el.innerHTML = '<br>';
            var frag = document.createDocumentFragment(), node, lastNode;
            while ((node = el.firstChild)) {
                lastNode = frag.appendChild(node);
            }
            var firstNode = frag.firstChild;
            range.insertNode(frag);

            // Preserve the selection
            if (lastNode) {
                range = range.cloneRange();
                range.setStartAfter(lastNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    } else if ((sel = document.selection) && sel.type != "Control") {
        // IE < 9
        var originalRange = sel.createRange();
        originalRange.collapse(true);
        sel.createRange().pasteHTML('<br>');
    }
}

function scrollToSubEntity() {
    microsoftTeams.getContext(function (context) {
        var subEntity = context['subEntityId'];
        //console.log("subentity: " + subEntity);
        if (subEntity != '') {
            var highlightedCase = document.getElementById(subEntity);
            highlightedCase.scrollIntoView({ behavior: 'smooth' });
        }

    });
}

function b64EncodeUnicode(str) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
}

function b64DecodeUnicode(str) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}