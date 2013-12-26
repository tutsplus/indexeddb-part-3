/* global console,$,document,window,alert,IDBKeyRange */
var db;

function dtFormat(input) {
    if(!input) return "";
    var res = (input.getMonth()+1) + "/" + input.getDate() + "/" + input.getFullYear() + " ";
    var hour = input.getHours();
    var ampm = "AM";
	if(hour === 12) ampm = "PM";
    if(hour > 12){
        hour-=12;
        ampm = "PM";
    }
    var minute = input.getMinutes()+1;
    if(minute < 10) minute = "0" + minute;
    res += hour + ":" + minute + " " + ampm;
    return res;
}

$(document).ready(function() {

	if(!("indexedDB" in window)) {
		alert("IndexedDB support required for this demo!");
		return;
	}
	
	var $noteDetail = $("#noteDetail");
	var $noteForm = $("#noteForm");
	
	var openRequest = window.indexedDB.open("nettuts_notes_4",1);

    openRequest.onerror = function(e) {
        console.log("Error opening db");
        console.dir(e);
    };

    openRequest.onupgradeneeded = function(e) {

        var thisDb = e.target.result;
		var objectStore;
		
        //Create Note OS
        if(!thisDb.objectStoreNames.contains("note")) {
            console.log("I need to make the note objectstore");
            objectStore = thisDb.createObjectStore("note", { keyPath: "id", autoIncrement:true });
            objectStore.createIndex("titlelc", "titlelc", { unique: false });
			objectStore.createIndex("tags","tags", {unique:false,multiEntry:true});
		}

    };

    openRequest.onsuccess = function(e) {
        db = e.target.result;

        db.onerror = function(event) {
          // Generic error handler for all errors targeted at this database's
          // requests!
          alert("Database error: " + event.target.errorCode);
        };

        displayNotes();
		doCount();
    };

    function displayNotes(filter) {

        var transaction = db.transaction(["note"], "readonly");  
        var content="<table class='table table-bordered table-striped'><thead><tr><th>Title</th><th>Updated</th><th>&nbsp;</td></thead><tbody>";

		transaction.oncomplete = function(event) {
            $("#noteList").html(content);
        };

        var handleResult = function(event) {  
          var cursor = event.target.result;  
          if (cursor) {  
            content += "<tr data-key=\""+cursor.key+"\"><td class=\"notetitle\">"+cursor.value.title+"</td>";
            content += "<td>"+dtFormat(cursor.value.updated)+"</td>";

            content += "<td><a class=\"btn btn-primary edit\">Edit</a> <a class=\"btn btn-danger delete\">Delete</a></td>";
            content +="</tr>";
            cursor.continue();  
          }  
          else {  
            content += "</tbody></table>";
          }  
        };  

        var objectStore = transaction.objectStore("note");

        if(filter) {
            //Credit: http://stackoverflow.com/a/8961462/52160
			filter = filter.toLowerCase();
            var range = IDBKeyRange.bound(filter, filter + "\uffff");
            var index = objectStore.index("titlelc");
            index.openCursor(range).onsuccess = handleResult;
        } else {
            objectStore.openCursor().onsuccess = handleResult;
        }
    
    }

	function doCount() {
		
		db.transaction(["note"],"readonly").objectStore("note").count().onsuccess = function(event) {
			$("#sizeSpan").text("("+event.target.result+" Notes Total)");
		};
	
	}

    $("#noteList").on("click", "a.delete", function(e) {
        var thisId = $(this).parent().parent().data("key");

		var t = db.transaction(["note"], "readwrite");
		var request = t.objectStore("note").delete(thisId);
		t.oncomplete = function(event) {
			displayNotes();
			doCount();
			$noteDetail.hide();
			$noteForm.hide();
		};
        return false;
    });

    $("#noteList").on("click", "a.edit", function(e) {
        var thisId = $(this).parent().parent().data("key");

        var request = db.transaction(["note"], "readwrite")  
                        .objectStore("note")  
                        .get(thisId);  
        request.onsuccess = function(event) {  
            var note = request.result;
            $("#key").val(note.id);
            $("#title").val(note.title);
            $("#body").val(note.body);
			$("#tags").val(note.tags.join(","));
			$noteDetail.hide();
			$noteForm.show();
        };  

        return false;
    });

    $("#noteList").on("click", "td", function() {
        var thisId = $(this).parent().data("key");
		displayNote(thisId);		
	});
	
	function displayNote(id) {
        var transaction = db.transaction(["note"]);  
        var objectStore = transaction.objectStore("note");  
        var request = objectStore.get(id);  

		request.onsuccess = function(event) {  
			var note = request.result;
			var content = "<h2>" + note.title + "</h2>"; 
			if(note.tags.length > 0) {
				content += "<strong>Tags:</strong> ";
				note.tags.forEach(function(elm,idx,arr) {
					content += "<a class='tagLookup' title='Click for Related Notes' data-noteid='"+note.id+"'> " + elm + "</a> ";	
				});
				content += "<br/><div id='relatedNotesDisplay'></div>";
			}
			content += "<p>" + note.body + "</p>";
			
			$noteDetail.html(content).show();
			$noteForm.hide();			
		};  
    }

	$("#addNoteButton").on("click", function(e) {
		$("#title").val("");
		$("#body").val("");
		$("#key").val("");
		$("#tags").val("");
		$noteDetail.hide();
		$noteForm.show();		
	});
	
    $("#saveNoteButton").on("click",function() {

        var title = $("#title").val();
        var body = $("#body").val();
        var key = $("#key").val();
		var titlelc = title.toLowerCase();
		
		//handle tags
		var tags = [];
		var tagString = $("#tags").val();
		if(tagString.length) tags = tagString.split(",");
		
		var t = db.transaction(["note"], "readwrite");
		
        if(key === "") {
            t.objectStore("note")
                            .add({title:title,body:body,updated:new Date(),titlelc:titlelc,tags:tags});
        } else {
            t.objectStore("note")
                            .put({title:title,body:body,updated:new Date(),id:Number(key),titlelc:titlelc,tags:tags});
        }

		t.oncomplete = function(event) {
            $("#key").val("");
            $("#title").val("");
            $("#body").val("");
			$("#tags").val("");
			displayNotes();
			doCount();
			$noteForm.hide();			
		};

        return false;
    });

    $("#filterField").on("keyup", function(e) {
        var filter = $(this).val();
        displayNotes(filter);
    });

	$(document).on("click", ".tagLookup", function(e) {
		var tag = e.target.text;
		var parentNote = $(this).data("noteid");
		var doneOne = false;
		var content = "<strong>Related Notes:</strong><br/>";

		var transaction = db.transaction(["note"], "readonly");
		var objectStore = transaction.objectStore("note");
		var tagIndex = objectStore.index("tags");
		var range = IDBKeyRange.only(tag);		

		transaction.oncomplete = function(event) {
			if(!doneOne) {
				content += "No other notes used this tag.";	
			}
			content += "<p/>";
			$("#relatedNotesDisplay").html(content);
		};
		
		var handleResult = function(event) {
			var cursor = event.target.result;
			if(cursor) {
				if(cursor.value.id != parentNote) {
					doneOne = true;
					content += "<a class='loadNote' data-noteid='"+cursor.value.id+"'>" + cursor.value.title + "</a><br/> ";
				}
				cursor.continue();
			}			
		};
		
		tagIndex.openCursor(range).onsuccess = handleResult;
		
	});
	
	$(document).on("click", ".loadNote", function(e) {
		var noteId = $(this).data("noteid");
		displayNote(noteId);
	});
	
});

