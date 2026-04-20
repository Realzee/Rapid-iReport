const str = `data-entry='{"id":"10525", "desc": "something\nnewline\nnewline"}' type="button"`;
const regex = /data-entry='(\{[\s\S]*?\})'/g;
let match;
while ((match = regex.exec(str)) !== null) {
  console.log("MATCH:", match[1]);
}
