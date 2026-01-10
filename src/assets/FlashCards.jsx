import ToolTemplate from "../template/ToolTemplate.jsx";
import "../styles/App.css"
import {useState} from "react";

// NOTA IMPORTANTE 1/6/2026: Evaluar la forma en la que podemos añadir los parámetros de cada flashcard y añadirlas con localStorage

const DisplayFlashCards = ({cards, addCardsFunction, startPractice, creatingCardsFunction}) => {

   let cardsLength = cards.length;


    return (
        <div className="flash-card-display">
            <div className="title-section">
                <h1>Flash Card Display</h1>
            </div>
            <div className="main-section">
                <div className="bar-section">
                    <div className="start-button">
                        <button onClick={startPractice}>Iniciar</button>
                    </div>
                    <div className="cards-information">
                        <span>
                            {cardsLength}
                            Tarjetas
                        </span>
                        <span>

                        </span>
                        <span>

                        </span>
                    </div>
                    <div className="add-button">
                        <button onClick={creatingCardsFunction}>Añadir</button>
                    </div>
                </div>
                <div className="cards-section">
                    <ul>
                        {cards.map((element, index) => (
                            <li key={index}>
                                {element.dato}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}

const DisplayPracticeCards = ({stopPractice}) => {

    return(
        <div className="practice-cards">
            <button onClick={stopPractice}>X</button>
            <h1>¿Listo para practicar?</h1>

            <div className="practice-cards-text">
                <h2>14</h2>
                <span>Cartas <br /> Disponibles</span>
            </div>

            <button>Empezar</button>
        </div>
    )
}

const CreatingTask = ({stopCreatingCardsFunction}) =>{
    return(
        <div>
            <h1>Creating Task</h1>
            <button onClick={stopCreatingCardsFunction}>X</button>
        </div>
    )
}

function Content({info, addCardsFunction}) {

    const [isPractice, setIsPractice] = useState(false);

    // isPractice define en que modo esta la app
    // - false -> vista normal
    // - true -> modo práctica

    const [isCreatingCard, setIsCreatingCard] = useState(false);


    function startPractice(){
        setIsPractice(true);
    }

    function stopPractice(){
        setIsPractice(false);
    }

    function creatingCardsFunction(){
        setIsCreatingCard(true);
    }

    function stopCreatingCardsFunction(){
        setIsCreatingCard(false);
    }

    return(
        <>
            {isPractice ? (
                <DisplayPracticeCards stopPractice={stopPractice}/>
            ) : (
                <DisplayFlashCards cards={info} addCardsFunction={addCardsFunction} startPractice={startPractice} creatingCardsFunction={creatingCardsFunction}/>
            )}

            {
                // Content decide qué pantalla mostrar
                // No mezcla lógica con UI
                // Cambiar isPractice cambia toda la experiencia
            }

            {isCreatingCard && (
                <CreatingTask stopCreatingCardsFunction={stopCreatingCardsFunction}/>
            )}
        </>
    )
}



function FlashCards() {

    const [cardsArray, setCardsArray] = useState([]);

    // Card Array
    // es la fuentes de verdad de las tarjetas
    // Aqui se presentan los datos reales
    // Acá se debe aplicar el localstorage

    function addCard(card){
        setCardsArray(prevState => [...prevState, card]);
    }

    // addCard()
    // Encargada de añadir una tarjeta nueva
    // No decide como es la tarjeta, solo la agrega

    return(
        <ToolTemplate className="flash-cards">
            <Content info={cardsArray} addCardsFunction={addCard} />
        </ToolTemplate>
    )

}

export default FlashCards;