/*
 *
 * Piece-related algorithms and functions.
 *
 */

/** Maximum integer value. */
var MAX_INT = Math.pow(2,53);

/** Maximum seed value. */
var MAX_SEED = 999999;

/** Ratio between shim side and base. */
var shimRatio = 64;

/** Angle of shim tip (in radians). Chord is 2*sin(angle/2). */
var shimAngle = 2*Math.asin(0.5/shimRatio);

/** Size of negative space in base units. */
var negativeSpace = 6;

/** Ten primes used to seed the linear congruential generator. */
var primes = [53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

/**
 * Generate increment value for linear congruential generator.
 *
 *  @param seed     Seed value whose decimal digits designate prime factors.
 *
 *  @return increment value for lcg()
 */
function lcg_increment(seed) {
    seed %= (MAX_SEED+1);
    if (seed==0) return primes[0];
    
    var c = 1;
    while (seed > 0) {
        c *= primes[seed % 10];
        seed = Math.floor(seed / 10);
    }
    return c;
}

/**
 * Linear congruential generator x_n+1 = (a.x_n + c) mod m.
 *
 * Used to generate a non-repeating sequence of m=2x^y integers starting at 0.
 *
 *  @param v    Previous value.
 *  @param c    Increment.
 *  @param x    Number of shims per shim unit.
 *  @param y    Number of shim units/slots per piece.
 *
 *  @return serial number.
 */
function lcg(v, c, x, y) {
    // Number of desired permutations.
    var m = 2*Math.pow(x, y);
    
    // LCG will have a full period if and only if:
    // 1. c and m are relatively prime
    // 2. a-1 is divisible by all prime factors of m
    // 3. a-1 is a multiple of 4 if m is a multiple of 4
    //
    // As m=2x^Y, prime factors of m are 2 and x, if x is prime, or x's prime
    // factors otherwise.
    // m is multiple of 4 if and only if x is multiple of 2.
    // #1 is met if x is less than the lowest prime factor used in 
    // lcg_increment().
    
    var a = 2*x+1;  // This guarantees #2 and #3.
    return (a*v+c) % m;
}

/**
 * Generate a random shim permutation.
 *
 *  @param index    Index of piece to generate.
 *  @param c        LCG increment value.
 *  @param x        Number of shims per shim unit.
 *  @param y        Number of shim units/slots per piece.
 *
 *  @return serial number.
 */
function generatePermutation(index, c, x, y) {
    var max = Math.pow(x, y);

    // Generate pseudorandom value in [0, 2*max) by calling LCG with sequence
    // number using the previously computed increment value.
    var r = lcg(index, c, x, y);
    
    // Sign.
    var sign;
    if (r < max) {
        // Negative / downward.
        sign = "-";
    } else {
        // Positive / upward.
        sign = "+";
        r -= max;
    }
    
    // Digits.
    var digits = "";
    for (var i = 0; i < y; i++) {
        digits += String.fromCharCode(65 + (r % x));
        r = Math.floor(r/x);
    }
    
    return sign + digits;
}

/**
 * Test function validating the LCG-based permutation generator.
 *
 *  Avoid calling with too large values!!!
 *
 *  @param x        Number of shims per shim unit.
 *  @param y        Number of shim units/slots per piece.
 *  @param seed     Seed used to generate LCG increment value.
 */
function testUnicity(x, y, seed) {
    var c = lcg_increment(seed);
    var max = 2*Math.pow(x,y);
    var values = Array();
    var dup = Array();
    for (var i = 0; i < max; i++) {
        var key = lcg(i, c, x, y);
        if (typeof(values[key]) === 'undefined') {
            values[key] = [i];
        } else {
            values[key].push(i);
            dup[key] = values[key];
        }
    }
    return {dup: dup, total: Object.keys(values).length};
}

/**
 * Rotate point *p* around center *c* by given *angle*.
 *
 *  @param c        Center of rotation.
 *  @param p        Point to rotate.
 *  @param angle    Rotation angle in radians.
 *
 *  @return Rotated point.
 */
function rotate(c, p, angle) {
    return {
        x: Math.cos(angle) * (p.x-c.x) - Math.sin(angle) * (p.y-c.y) + c.x,
        y: Math.sin(angle) * (p.x-c.x) + Math.cos(angle) * (p.y-c.y) + c.y
    };
}

/**
 * Project line passing trought *c* and *p* on horizontal line at *y*.
 *
 *  @param c, p     Points on line to project.
 *  @param y        Y-coordinate of line to project onto.
 *
 *  @return Projected point.
 */
function project(c, p, y) {
    return {
        x: c.x + (p.x-c.x) / (p.y-c.y) * (y-c.y),
        y: y
    };
}

/**
 * Compute a piece from its serial number.
 *
 *  @param sn       The piece serial number.
 *  @param crop     Cropped mode.
 *
 *  @return The piece object.
 */
function computePiece(sn, crop) {
    if (sn.length < 2 || (sn[0] != '+' && sn[0] != '-')) return;

    //
    // 1. Iterate over slots and build shim coordinates.
    //
    
    var slots = Array(); // Array of slots.
    var nbSlots = sn.length-1;
    var angleStep = 0; // Rotation steps, each of shimAngle radians.
    var upward = (sn[0]=='+'); // Whether first shim is pointing upward.
    for (var iSlot = 0; iSlot < nbSlots; iSlot++) {
        // Left base corner of first shim when angle = 0 (vertical).
        var p1_base = {x: 0, y: (upward ? shimRatio : 0)};

        var shims = Array();
        slots[iSlot] = {shims: shims, angleStep: angleStep, upward: upward};
        
        // Iterate over shims.
        var nbShims = sn.charCodeAt(iSlot+1)-64; /* A=65 */
        for (var iShim = 0; iShim < nbShims; iShim++) {
            var p0 = {x: 0, y: (upward ? 0 : shimRatio)};
            var p1 = rotate(p0, p1_base, angleStep * shimAngle);
            angleStep -= (upward ? 1 : -1);
            var p2 = rotate(p0, p1_base, angleStep * shimAngle);
            
            // Shim = array of points.
            shims[iShim] = [p0, p1, p2];
        }
        
        // Flip orientation of next slot.
        upward = !upward;
    }
    
    //
    // 2. Crop shims.
    //

    var height = shimRatio;
    if (crop) {
        // Compute piece height, i.e. minimal y-distance between shim tip and 
        // corners.
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                height = Math.min(
                    height,
                    Math.abs(shim[1].y-shim[0].y),
                    Math.abs(shim[2].y-shim[0].y)
                );
            }
        }
        
        //  Align downward shims tip on bottom side.
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                if (slot.upward) continue;
                for (i = 0; i < 3; i++) {
                    shim[i].y -= shimRatio-height;
                }
            }
        }
        
        // Crop slots by piece height.
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                for (i = 1; i < 3; i++) {
                    shim[i] = project(
                        shim[0], shim[i], 
                        (slot.upward ? height : 0)
                    );
                }
            }
        }
    }
    
    //
    // 3. Build negative spaces according to alignment rules.
    //
    //  - Project previous slot's right side on next slot's tip side, then shift 
    //    horizontally by negative space. 
    //  - Align downward shims tip on bottom side.
    //
    for (var iSlot = 1; iSlot < slots.length; iSlot++) {
        var slot = slots[iSlot];
        var prevSlot = slots[iSlot-1];
        var prevShim = prevSlot.shims[prevSlot.shims.length-1];
        var prevTip = prevShim[0];
        var prevRight = prevShim[2];
        var shift =   project(
                        prevTip, prevRight, 
                        slot.upward ? 0 : height
                     ).x
                    + negativeSpace;
        
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            for (i = 0; i < 3; i++) {
                shim[i].x += shift;
            }
        }
    }
    
    //
    // 4. Compute bounding box.
    //
    
    var x=0, y=0, x2=0, y2=0;
    for (var iSlot = 0; iSlot < slots.length; iSlot++) {
        var slot = slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            for (i = 0; i < 3; i++) {
                x = Math.min(x, shim[i].x);
                y = Math.min(y, shim[i].y);
                x2 = Math.max(x2, shim[i].x);
                y2 = Math.max(y2, shim[i].y);
            }
        }
    }
    
    return {sn: sn, slots: slots, bbox: {x: x, y: y, x2: x2, y2: y2}};
}

/**
 * Output a piece as SVG.
 *
 *  @param piece        The piece data.
 *  @param element      DOM element for output (optional).
 *
 *  @return Snap object.
 */
function drawSVG(piece, element) {
    var svg = Snap(element);
    svg.clear();
    for (var iSlot = 0; iSlot < piece.slots.length; iSlot++) {
        var slot = piece.slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            svg.polygon(
                shim[0].x, shim[0].y,
                shim[1].x, shim[1].y,
                shim[2].x, shim[2].y
            ).attr('class', "shim");
        }
    }
    svg.rect(
        piece.bbox.x, piece.bbox.y,
        piece.bbox.x2-piece.bbox.x,
        piece.bbox.y2-piece.bbox.y
    ).attr('class', "bbox");
    return svg;
}

/**
 * Draw a piece into a PDF document.
 *
 *  @param piece        The piece data.
 *  @param pdf          jsPDF document.
 *  @param scale        Scaling factor.
 *  @param offx, offy   Position of top-left corner.
 */
function drawPDF(piece, pdf, scale, offx, offy) {
    // Line width. Use same for shims and bbox.
    pdf.setLineWidth(0.05*scale);
    
    for (var iSlot = 0; iSlot < piece.slots.length; iSlot++) {
        var slot = piece.slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            pdf.triangle(
                shim[0].x*scale+offx, shim[0].y*scale+offy,
                shim[1].x*scale+offx, shim[1].y*scale+offy,
                shim[2].x*scale+offx, shim[2].y*scale+offy,
                'D'
            );
        }
    }
    pdf.rect(
        piece.bbox.x*scale+offx, piece.bbox.y*scale+offy, 
        (piece.bbox.x2-piece.bbox.x)*scale, (piece.bbox.y2-piece.bbox.y)*scale, 
        'D'
    );
}

/**
 * Generate a multi-page PDF from a set of pieces.
 *
 *  @param cropped          Cropped output.
 *  @param orient           Orientation ('portrait', 'landscape').
 *  @param format           Page format ('a3', 'a4','a5' ,'letter' ,'legal').
 *  @param labelPos         Piece S/N label position ('none', 'top','bottom').
 *  @param cols             Minimum number of columns per page.
 *  @param rows             Minimum number of rows per page.
 *  @param maxPieces        Maximum overall number of pieces to print.
 *  @param maxPiecesPerDoc  Maximum number of pieces per document.
 *  @param maxPagesPerDoc   Maximum number of pages per document.
 *  @param onprogress       Progress callback, called with args (nb, nbPrint, page, nbPages, doc, nbDocs).
 *  @param onfinish         Finish callback.
 */
function piecesToPDF(cropped, orient, format, labelPos, cols, rows, maxPieces, maxPiecesPerDoc, maxPagesPerDoc, onprogress, onfinish) {
    // Various sizes.
    var fontSizePt = 10; /* pt */
    var fontSizeMm = fontSizePt * 0.352778;
    var margin = 15; /* mm */
    var padding = 10; /* mm */
    
    // Create jsPDF object.
    var pdf = new jsPDF(orient, 'mm', format);
    pdf.setFontSize(fontSizePt);
    
    // Compute scaling and actual number of rows/cols.
    var availWidth = pdf.internal.pageSize.width - margin*2 - padding*(cols-1);
    var availHeight = pdf.internal.pageSize.height - margin*2 - padding*(rows-1);
    var w = availWidth / cols;
    var h = availHeight / rows;
    var scale = Math.min(w/maxWidth, h/shimRatio);
    w = maxWidth*scale;
    h = shimRatio*scale;
    cols = Math.floor((pdf.internal.pageSize.width - margin*2 + padding) / (w + padding));
    rows = Math.floor((pdf.internal.pageSize.height - margin*2 + padding) / (h + padding));
    
    var nbPiecesPerPage = cols*rows;
    
    // Actual number of pieces.
    var nbPrint = Math.min(nbSelected, maxPieces);
    
    // Actual number of pages per document.
    var nbPagesPerDoc = Math.min(Math.ceil(maxPiecesPerDoc/nbPiecesPerPage), maxPagesPerDoc);
    
    // Actual number of pages overall.
    var nbPages = Math.ceil(nbPrint/nbPiecesPerPage);
    
    // Actual number of docs.
    var nbDocs = Math.ceil(nbPages/nbPagesPerDoc);
    
    // Draw each piece.
    var col = 0, row = 0, nb = 0, page = 1, firstPage = 1, doc = 1;
    var draw = function(i) {
        // Next column.
        if (nb > 0 && ++col >= cols) {
            // Next row.
            col = 0;
            if (++row >= rows) {
                // Next page.
                row = 0;
                if ((page % nbPagesPerDoc) == 0) {
                    // Next doc.
                    save();
                    pdf = new jsPDF(orient, 'mm', format);
                    pdf.setFontSize(fontSizePt);
                    page++;
                    firstPage = page;
                } else {
                    pdf.addPage();
                    page++;
                }
            }
        }
        
        // Compute offset in gridded layout.
        var offx = margin + (w + padding) * col;
        var offy = margin + (h + padding) * row;
        
        // Output piece at the right place.
        var sn = generatePermutation(i, c, x, y)
        drawPDF(computePiece(sn, cropped), pdf, scale, offx, offy);
        
        // Output label.
        switch (labelPos) {
            case 'top':
                pdf.text(offx, offy - 1, sn);
                break;
            case 'bottom':
                pdf.text(offx, offy + h + fontSizeMm, sn);
                break;
        }
        nb++;
    }
    var save = function() {
        // Save current PDF document.
        saveAs(new Blob([pdf.output()], {type: 'application/pdf'}), x+"-"+y+"-"+seed+"."+firstPage+"-"+page+".pdf");
        onprogress(nb, nbPrint, page, nbPages, doc, nbDocs);
        doc++;
    }
    
    if (defaultSelected) {
        // All pieces but toggled ones.
        var i = 0;
        var step = 100;
        var drawBg = function() {
            for (; i < nbPieces; i++) {
                if (pieceToggle[i]) continue;
                draw(i);

                if (nb >= nbPrint) {
                    save();
                    setTimeout(onfinish, 0);
                    return;
                }
                
                if ((nb % step) == 0) {
                    onprogress(nb, nbPrint, page, nbPages, doc, nbDocs);
                    setTimeout(drawBg, 0);
                    i++;
                    break;
                }
            }
        }
        drawBg();
    } else {
        // Only toggled pieces
        // Note: no progress here, we expect the number of pieces to be small.
        for (var i in pieceToggle) {
            draw(parseInt(i));

            if (nb >= nbPrint) {
                save();
                setTimeout(onfinish, 0);
                return;
            }
        }
    }
}

/**
 * Generate a Zip archive of SVG files from a set of pieces.
 *
 *  @param cropped          Cropped output.
 *  @param maxPieces        Maximum overall number of pieces to export.
 *  @param maxPiecesPerZip  Maximum number of pieces per Zip file.
 *  @param onprogress       Progress callback, called with args (nb, nbPrint, page, nbPages, doc, nbDocs).
 *  @param onfinish         Finish callback.
 */
function piecesToZip(cropped, maxPieces, maxPiecesPerZip, onprogress, onfinish) {
    // Create JSZip object.
    var zip = new JSZip();
    
    // Actual number of pieces.
    var nbSvg = Math.min(nbSelected, maxPieces);
    
    // Actual number of Zip files.
    var nbFiles = Math.ceil(nbSvg/maxPiecesPerZip);
    
    // Output each piece as SVG file.
    var svgTmp = $("#tmpSvg svg")[0];
    var nb = 0, file = 1;
    var generateSvg = function(i) {
        if (nb > 0 && (nb % maxPiecesPerZip) == 0) {
            // Next file.
            save();
            zip = new JSZip();
        }
        
        // Generate SVG from piece.
        var sn = generatePermutation(i, c, x, y)
        var piece = computePiece(sn, cropped);
        var svg = drawSVG(piece, svgTmp);
        svg.attr('viewBox', 
            piece.bbox.x 
            + " " + piece.bbox.y 
            + " " 
            + (piece.bbox.x2-piece.bbox.x) 
            + " " 
            + (piece.bbox.y2-piece.bbox.y)
        );
        svg.attr({fill: 'none', stroke: 'black', strokeWidth: 0.1});
        
        // Add SVG to Zip file.
        zip.file(sn + ".svg", svg.outerSVG());
        nb++;
    }
    var save = function() {
        saveAs(zip.generate({type: 'blob', compression: 'DEFLATE'}), x+"-"+y+"-"+seed+((nbFiles > 1) ? "."+file : "")+".zip");
        onprogress(nb, nbSvg, undefined, undefined, file, nbFiles);
        file++;
    }
    
    if (defaultSelected) {
        // All pieces but toggled ones.
        var i = 0;
        var step = 100;
        var generateBg = function() {
            for (; i < nbPieces; i++) {
                if (pieceToggle[i]) continue;
                generateSvg(i);

                if (nb >= nbSvg) {
                    save();
                    setTimeout(onfinish, 0);
                    return;
                }
                
                if ((nb % step) == 0) {
                    onprogress(nb, nbSvg, undefined, undefined, file, nbFiles);
                    setTimeout(generateBg, 0);
                    i++;
                    break;
                }
            }
        }
        generateBg();
    } else {
        // Only toggled pieces
        // Note: no progress here, we expect the number of pieces to be small.
        for (var i in pieceToggle) {
            generateSvg(parseInt(i));

            if (nb >= nbSvg) {
                save();
                setTimeout(onfinish, 0);
                return;
            }
        }
    }
}


/*
 *
 * Interface functions.
 *
 */

/** Handles. */
var x, y;

/** Maximum theoretical piece width. */
var maxWidth;

/** Number of generated pieces. */
var nbPieces;

/** Permutation seed. */
var seed;

/** LCG increment value generated from seed. */
var c;

/** Columns and rows to display. */
var columns, rows;

/** Column class for piece elements. */
var colClass;

/** Paging. */
var nbPages, nbPerPage;

/** Default selection state. */
var defaultSelected;

/** Piecewise selection toggle state. */
var pieceToggle;

/** Number of toggled pieces. We can't rely on pieceToggle.length because JS 
 *  may switch between vector and object for sparse array storage. */
var nbToggle;

/** Number of selected pieces. */
var nbSelected;

/**
 * Validation for integer inputs. Replace the input value with a reasonable
 * integer:
 *
 *  - non-numeric strings are replaced by the min value.
 *  - floating point strings are rounded toward zero.
 *  - final value is kept between min and max.
 */
function validateInteger() {
    var min = parseInt($(this).attr('min'));
    var max = parseInt($(this).attr('max'));
    if (!$.isNumeric(this.value)) {
        this.value = min;
    } else {
        this.value = parseInt(this.value);
    }
    if (parseInt(this.value) < min) {
        this.value = min;
    } else if (parseInt(this.value) > max) {
        this.value = max;
    }
}

/**
 * Ensure that permutation is not too large. Else disable interface elements.
 */ 
function validatePermutationSize() {
    var x = parseInt($("#x").val());
    var y = parseInt($("#y").val());
    var nbPieces = 2*Math.pow(x,y);
    if (nbPieces > MAX_INT) {
        // Permutation too large.
        $("#generate").removeClass("btn-default").addClass("btn-danger").prop('disabled', true);
        $("#x, #y").parent().addClass("has-error bg-danger");
        $("#message").addClass("panel-body").html("<div class='alert alert-danger'><span class='glyphicon glyphicon-warning-sign'></span> Permutation size too large!</div>");
    } else {
        $("#generate").removeClass("btn-danger").addClass("btn-primary").prop('disabled', false);
        $("#x, #y").parent().removeClass("has-error bg-danger");
        $("#message").removeClass("panel-body").empty();
    }
}

/**
 * Generate a new set of pieces.
 */
function generatePieces() {
    $("#zip").prop('disabled', false);
    $("#print").prop('disabled', false);

    // Get algorithm handles.
    x = parseInt($("#x").val());
    y = parseInt($("#y").val());

    // Number of pieces to generate.
    nbPieces = parseInt($("#nbPieces").val());
    if ($("#max").prop('checked')) {
        // Use max number of pieces.
        nbPieces = 2*Math.pow(x,y);
    }
    
    // Maximum theoretical piece width.
    maxWidth = Math.ceil(y/2)*x + negativeSpace*(y-1);

    // Get/generate seed.
    if ($("#random").prop('checked')) {
        // Generate random seed.
        seed = Math.floor(Math.random() * (MAX_SEED+1));
        $("#seed").val(seed);
    }
    seed = parseInt($("#seed").val());
    seed %= (MAX_SEED+1);
    
    // LCG increment value.
    c = lcg_increment(seed);
    
    // Set default selection state.
    defaultSelected = true;
    pieceToggle = Array();
    nbToggle = 0;
    updateSelected();
    
    // Adjust column layout.
    columns = parseInt($("#columns").val());
    switch (columns) {
        case 0:
            // Automatic, use 4-column responsive layout.
            columns = 4;
            colClass = "col-xs-12";
            if (nbPieces >= 2) {
                colClass += " col-sm-6";
            }
            if (nbPieces >= 3) {
                colClass += " col-md-4";
            }
            if (nbPieces >= 4) {
                colClass += " col-lg-3";
            }
            break;
            
        case 1:
            colClass = "col-xs-12";
            break;
            
        case 2:
            colClass = "col-xs-12 col-sm-6";
            break;
            
        case 3:
            colClass = "col-xs-12 col-sm-4";
            break;
            
        case 4:
            colClass = "col-xs-12 col-sm-3";
            break;
            
        case 6:
            colClass = "col-xs-12 col-sm-2";
            break;
    }
    rows = parseInt($("#rows").val());
    
    // Paging.
    nbPerPage = columns*rows;
    nbPages = Math.ceil(nbPieces/nbPerPage);

    // Display first page
    displayPieces(0);
}

/** 
 * Display pieces for a given page.
 *
 *  @param page     Page number (zero-indexed).
 */
function displayPieces(page) {
    // Sanity check.
    page = Math.max(0, Math.min(page, nbPages-1));
    
    // Display toolbar.
    $("#toolbar").removeClass("hidden");
    
    // Display pager.
    var $pager = $("#pager");
    $pager.empty();
    if (nbPages > 1) {
        var pager = "<ul class='pagination pagination-sm'>";
        pager += "<li" + (page==0?" class='disabled'":"") + "><a href='javascript:displayPieces(" + Math.max(0,page-1) + ")'>&laquo;</a></li>";
        for (var i = 0; i < nbPages; i++) {
            if (nbPages > 10) {
                // Limit buttons to 10, add ellipses for missing buttons.
                if (page < 5) {
                    if (i == 8) {
                        // Ellipsis at end.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-2;
                        continue;
                    }
                } else if (page >= nbPages-5) {
                    if (i == 1) {
                        // Ellipsis at beginning.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-9;
                        continue;
                    }
                } else {
                    if (i == 1) {
                        // Ellipsis at beginning.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = page-3;
                        continue;
                    } else if (i == page+3) {
                        // Ellipsis at end.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-2;
                        continue;
                    }
                }
            }
            pager += "<li" + (i==page?" class='active'":"") + "><a href='javascript:displayPieces(" + i + ")'>" + (i+1) + "</a></li>";
        }
        pager += "<li" + (page==nbPages-1?" class='disabled'":"") + "><a href='javascript:displayPieces(" + Math.min(page+1,nbPages-1) + ")'>&raquo;</a></li>";
        pager += "</ul>";
        $pager.append(pager);
    }    
    
    // Clear existing pieces.
    var $pieces = $("#pieces");
    $pieces.empty();
    
    // Generate piece output elements.
    var begin = nbPerPage*page;
    var end = Math.min(begin+nbPerPage, nbPieces);
    for (var i = begin; i < end; i++) {
        // Selection state.
        var selected = defaultSelected;
        if (pieceToggle[i]) selected = !selected;
        
        var piece = "<div id='piece-" + i + "' class='form-inline piece " + colClass + "'>";
        piece += "<div class='thumbnail'>";
        piece += "<input id='piece-select-" + i + "' class='piece-select' data-piece='" + i + "' type='checkbox' onclick='togglePiece(" + i + ")' " + (selected?" checked":"") + "/> ";
        piece += "<label for='piece-select-" + i + "'>";
        piece += "<svg xmlns='http://www.w3.org/2000/svg' version='1.1'></svg><br/>";
        piece += "</label>";
        piece += "<div class='input-group input-group-sm'>";
        piece += "<input type='text' class='form-control sn' readonly placeholder='Piece S/N' value='" + generatePermutation(i, c, x, y) + "' size='" + y + "'/>";
        piece += "<span class='input-group-btn'><button type='button' class='btn btn-default' onclick='downloadSVG($(this).parent().parent().find(\".sn\").val().trim())'><span class='glyphicon glyphicon-download'></span> SVG</button></span>"
        piece += "</div>";
        piece += "</div>";
        piece += "</div>";
        $pieces.append(piece);
    }
    
    // Display pieces.
    $pieces.find(".piece").each(function(index, element) {
        updatePiece(element);
    });
}

/**
 * Update existing piece when some parameter changes (e.g. cropping).
 */
function updatePieces() {
    $("#pieces .piece").each(function(index, element) {
        updatePiece(element);
    });
}

/**
 * Compute & output piece from its S/N.
 *
 *  @param element    The containing element.
 */
function updatePiece(element) {
    var sn = $(element).find(".sn").val().trim();
    
    // Generate piece.
    var cropped = $("#cropped").prop('checked');    
    var piece = computePiece(sn, cropped);
    
    // Output to SVG.
    var svg = drawSVG(piece, $(element).find("svg")[0]);
    
    // Adjust viewbox so that all pieces are centered and use the same scale.
    svg.attr('viewBox', 
        ((piece.bbox.x2-piece.bbox.x)-maxWidth)/2
        + " "
        + ((piece.bbox.y2-piece.bbox.y)-shimRatio)/2
        + " " + maxWidth + " " + shimRatio);
}

/**
 * Toggle select state of given piece.
 *
 *  @param piece    Piece number to toggle.
 */
function togglePiece(piece) {
    if (pieceToggle[piece]) {
        delete pieceToggle[piece];
        nbToggle--;
    } else {
        pieceToggle[piece] = true;
        nbToggle++;
    }
    updateSelected();
    
}

/**
 * Check/uncheck visible pieces.
 *
 *  @param  check   Whether to check or uncheck pieces.
 */
function checkVisible(check) {
    $(".piece-select").each(function(index, element) {
        if (element.checked^check) {
            $(element).click();
        }
    });
}

/**
 * Check/uncheck all pieces.
 *
 *  @param  check   Whether to check or uncheck pieces.
 */
function checkAll(check) {
    checkVisible(check);
    defaultSelected = check;
    nbToggle = 0;
    pieceToggle = Array();
    updateSelected();
}

/**
 * Update selected piece counters.
 */
function updateSelected() {
    nbSelected = (defaultSelected ? nbPieces - nbToggle : nbToggle);
    $("#totalPieces").html(nbPieces);
    $("#selectedPieces").html(nbSelected);
    $("#zip").prop('disabled', (nbSelected == 0));
    $("#print").prop('disabled', (nbSelected == 0));
}

/**
 * Download piece as SVG.
 *
 *  @param sn   The piece serial number.
 */
function downloadSVG(sn) {
    // Generate piece.
    var cropped = $("#cropped").prop('checked');
    var piece = computePiece(sn, cropped);
    
    // Output to SVG.
    var svg = drawSVG(piece, $("#tmpSvg svg")[0]);
    svg.attr('viewBox', 
        piece.bbox.x 
        + " " + piece.bbox.y 
        + " " 
        + (piece.bbox.x2-piece.bbox.x) 
        + " " 
        + (piece.bbox.y2-piece.bbox.y)
    );
    svg.attr({fill: 'none', stroke: 'black', strokeWidth: 0.1});

    blob = new Blob([svg.outerSVG()], {type: "image/svg+xml"});
    saveAs(blob, sn + ".svg");
    
} 

/**
 * Update progress information during PDF output.
 *
 *  @param ratio    Progress ratio [0,1].
 *  @param piece    Number of pieces output so far.
 *  @param nbPieces Total number of pieces (optional).
 *  @param page     Number of pages output so far (optional).
 *  @param nbPages  Total number of pages (optional).
 *  @param doc      Number of documents output so far (optional).
 *  @param nbDocs   Total number of documents (optional).
 */
function progress(piece, nbPieces, page, nbPages, doc, nbDocs) {
    var percent = (piece/nbPieces)*100;
    // console.log("progress", piece, nbPieces, page, nbPages, doc, nbDocs)
    // console.log("percent", percent);
    $("#progress .progress-bar").attr('aria-valuenow', percent).attr('style','width:'+percent.toFixed(2)+'%').find("span").html(percent.toFixed(0) + "%)");
    $("#progressPiece").html("Piece " + piece + "/" + nbPieces);
    $("#progressPage").html((page && nbPages) ? "Page " + page + "/" + nbPages : "");
    $("#progressDoc").html((doc && nbDocs) ? "Document " + doc + "/" + nbDocs : "");
}

/**
 * Output pieces to PDF.
 */
function downloadPDF() {
    $("#printDialog").modal('hide');
    $("#progressDialog").modal('show');
    piecesToPDF(
        $("#cropped").prop('checked'),
        $("[name='orient']:checked").val(), 
        $("[name='format']:checked").val(),
        $("[name='labelPos']:checked").val(),
        $("#printColumns").val(),
        $("#printRows").val(),
        $("#maxPieces").val(),
        $("#maxPiecesPerDoc").val(),
        $("#maxPagesPerDoc").val(),
        progress,
        function() {$("#progressDialog").modal('hide');}
    );
}

/**
 * Output pieces to zipped SVG.
 */
function downloadZip() {
    $("#zipDialog").modal('hide');
    $("#progressDialog").modal('show');
    piecesToZip(
        $("#cropped").prop('checked'),
        $("#maxZip").val(),
        $("#maxPiecesPerZip").val(),
        progress,
        function() {$("#progressDialog").modal('hide');}
    );
}
