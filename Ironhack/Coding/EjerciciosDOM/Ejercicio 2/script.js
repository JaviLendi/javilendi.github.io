// Secret number: what the user will have to guess
const secretNumber = 55;

const ulElement = document.createElement('ul');
ulElement.id = 'list';

// Insertar el elemento ul en el cuerpo del documento
document.body.appendChild(ulElement);

// Limpiar la lista de feedback al ingresar un nuevo número
list.innerHTML = '';

// Iteration 1: Select the input
document.getElementById('guess-input').addEventListener('input', function() {
    userInput = this.value;
    console.log('Input:', userInput);
    localStorage.setItem('guess-input', userInput);
});


// Iteration 2: Select the button and add the event listener
document.getElementById('guess-btn').onclick = function() {
    sentInput = userInput;
    console.log('sent Input:', sentInput);
    localStorage.setItem('guess-input', sentInput);
    checkGuess();
    counter();
};

// Iteration 3: Add a try counter variable
let tryCounter = 0;
function counter() {
    tryCounter++;
    localStorage.setItem('tryCounter', tryCounter);
    //console.log('nº of tries: ', tryCounter)
}

// Iteration 4: Complete the function
function checkGuess() {
    const tryelement = document.createElement('li');
    tryelement.textContent = `Try number ${tryCounter}: ${sentInput}`;
    if (sentInput < secretNumber) {
        alert(`Muy bajo, prueba un valor más alto. Número de intentos: ${tryCounter}`);
        console.log(`Muy alto, prueba un valor más alto. Número de intentos: ${tryCounter}`);
        list.appendChild(tryelement);
    } else if (sentInput > secretNumber) {
        alert(`Muy alto, prueba un valor más bajo. Número de intentos: ${tryCounter}`);
        console.log(`Muy bajo, prueba un valor más bajo. Número de intentos: ${tryCounter}`);
        list.appendChild(tryelement);
    } else {
        alert(`¡Ganaste! El número secreto era ${secretNumber}, Número de intentos: ${tryCounter}`);
        console.log(`¡Ganaste! El número secreto era ${secretNumber}, Número de intentos: ${tryCounter}`);
        // Reiniciar el juego si lo deseas
        resetGame();    
    }
}

function resetGame() {
    // Reiniciar el juego generando un nuevo número secreto y reiniciando el contador de intentos
    const secretNumber = Math.floor(Math.random() * 100) + 1;
    console.log(secretNumber)
    tryCounter = 0;
    
}

// Iteration 5: Make the tries show on the page

