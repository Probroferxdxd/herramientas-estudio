import {Back} from "../App.jsx";


const ToolTemplate = ({className, children}) => {
    return(
        <div className={`tool-container tool-${className}`}>
            <header>
                <Back />
            </header>
            <main>
                {children}
            </main>
        </div>
    )
}

export default ToolTemplate