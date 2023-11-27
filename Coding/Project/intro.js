// Function to fetch and insert the content
function insertContent(url, containerId) {
    fetch(url)
        .then(response => response.text())
        .then(html => {
            // Insert the content into the specified container
            document.getElementById(containerId).innerHTML = html;
        })
        .catch(error => console.error(`Error fetching ${url}:`, error));
}

// Call the insertContent function for the content when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    insertContent('login.html', 'login');
    insertContent('footer.html', 'footer');
});

// When the user scrolls down from the top of the document, resize the navbar's padding and the logo's font size
window.onscroll = function () { scrollFunction() };

function scrollFunction() {
    if (document.body.scrollTop > 60 || document.documentElement.scrollTop > 60) {
        document.getElementById("Desktop_nav").style.padding = "0.4rem 1rem";
        document.getElementById("logo").style.fontSize = "2rem";
    } else {
        document.getElementById("Desktop_nav").style.padding = "3.5rem 2rem";
        document.getElementById("logo").style.fontSize = "2rem";
    }
}

// Load the login window
var login = document.getElementById('idcontraseña');

// To exit the window login
window.onclick = function(event) {
    if (event.target == login) {
        login.style.display = 'none';
        console.log('Funciona');
    }
}

function comprobarcontraseña() {
    var password = "1234";
    var contrasena = document.getElementById("pswd").value;
    if (contrasena == password) {
        location.href("miembros.html")
    }
    else{
        let text = document.createTextNode('Contraseña incorrecta');
        let p = document.getElementById('message');
        p.innerHTML = '';
        p.appendChild(text);
        p.style.display = "block";
    }
}

