console.log('Everything up and running!')

let paragraph = document.getElementById('paragraph');
console.log(paragraph);
let links = document.getElementsByClassName('link');
console.log(links);
let divs = document.getElementsByTagName('div');
console.log(divs);

let paragraphId = paragraph.getAttribute('id');
console.log(paragraphId);

let googleLink = document.getElementById("google-link");
googleLink.setAttribute('href','https://duckduckgo.com');
googleLink.setAttribute('target','blank')

paragraph.removeAttribute('id');
paragraph.setAttribute('class', 'paragraphuuu');

let parrafos = document.getElementsByTagName('p');
for(let i =0; i < parrafos.length; i++) {
    parrafos[i].removeAttribute('class')
}

let h2Element = document.createElement('h2');
h2Element.innerHTML = 'Soy un encabezado';

let body = document.getElementsByTagName('body')[0];
body.appendChild(h2Element);

let text = document.createTextNode('This text is created dinamically');
body.appendChild(text);

let cuentaItem = 1;
let list = document.getElementById('item-list')

let button = document.getElementById('add-item-button');
button.onclick = function() {
    let element = document.createElement('li');
    element.innerText = 'Elemento número ' + cuentaItem + '' + user;
    cuentaItem++;
    list.appendChild(element);
}

let sendBtn = document-getElementById('send-btn');
let user = '';
sendBtn.onclick = function () {
    let userNameElement = document.getElementById('username');
    let username = userNameElement.ariaValueMax;
    console.log(username)
}