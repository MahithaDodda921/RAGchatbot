import "./global.css"

export const metadata={
    title: "NewsGPT",
    description: "The place to go for all your Tech questions!"
}

const RootLayout = ({children}) => {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}

export default RootLayout;