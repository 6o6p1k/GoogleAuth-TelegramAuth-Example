var React = require('react');
var TopNav = require('../partials/topNavigation.jsx');


class Page extends React.Component {
    render() {
        return (
            <html>
                <head>
                    <title>{this.props.title}</title>
                    <link rel="stylesheet" href="/vendor/bower_components/bootstrap/dist/css/bootstrap.css"/>
                    <link rel="stylesheet" href="/css/app.css"/>
                </head>
                <body>
                    {this.props.children}
                    <header>
                        {this.props.headers}
                    </header>
                    <TopNav user={this.props.user} class="container"/>

                    <h1>Hello ≥︺‿︺≤</h1>
                    <p class="lead">Hello All!</p>
                    <footer>
                        {this.props.footer}
                    </footer>
                </body>
            </html>
        );
    }
}

module.exports = Page;