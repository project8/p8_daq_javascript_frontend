//safely set a cell value in a datatable, add rows to account for rowindex
function safesetCell(d,rowIndex,columnIndex,value)
{
//	alert("rowindex "+ rowIndex +" number of rows "+d.getNumberOfRows());
	while(d.getNumberOfRows()<=rowIndex) {
//		alert("adding row");
		d.addRow();
	}
	d.setCell(rowIndex,columnIndex,value);
}

//takes in a couchdb json response and an array of column names
//returns a gviz DataTable
//this only works if every couch entry corresponds to a row
function convert_couch_to_gviz(couchdata,columntypes,columnnames)
{
	var datatable = new google.visualization.DataTable();
	for( var i=0;i<columntypes.length;i++) {
		datatable.addColumn(columntypes[i],columnnames[i],columnnames[i]);
	}
//	alert("couchdata is "+JSON.stringify(couchdata));
//	alert("number of columns is "+columntypes.length+" number of rows "+couchdata.rows.length);
	for(var i=0;i<couchdata.rows.length;i++) {
	for(var j=0;j<columnnames.length;j++) {
		safesetCell(datatable,i,j,couchdata.rows[i].value[columnnames[j]]);
	} }
	return datatable;
}
