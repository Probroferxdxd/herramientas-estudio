import {Link, Outlet} from "react-router-dom";
import FlashCards from "./FlashCards.jsx";
import RecallApp from "./RecallApp.jsx";
import "../styles/App.css"


const toolsArray = [
    {
        name: "About",
        element: <FlashCards />,
    },
    {
        name: "Recall-app",
        element: <RecallApp />,
    }
]

const Tools = () => {
    return(
        <div className="tools-container">
            {toolsArray.map((tool, index) => (
                <div key={index}>
                    <Link key={index} to={`/${tool.name}`}>{tool.name}</Link>
                </div>
            ))}
        </div>
    )
}

const Home = () => {
    return (
        <div className="home-container">
            <h1>Página de Inicio</h1>
            <Tools />

        </div>
    )
}

export default Home