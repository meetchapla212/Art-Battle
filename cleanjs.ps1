Get-ChildItem ./client/src -recurse -include *.js.map, *.js | remove-item
Get-ChildItem ./server/src -recurse -include *.js.map, *.js | remove-item