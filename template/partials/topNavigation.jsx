var React = require('react');


class TopNav extends React.Component {

    render() {
        if (this.props.user) {
            return (
                <nav class="navbar navbar-default" role="navigation">
                    <ul class="nav navbar-nav">
                        <li>
                            <a href="/">MAIN</a>
                        </li>
                        <li>
                            <a href="/chat">CHAT</a>
                        </li>
                        <li>
                            <a href="/userPage">MY PROFILE</a>
                        </li>
                    </ul>
                    <ul class="nav navbar-nav navbar-right">
                        <li>
                            <a href="#" onClick={this.logOut}>SIGN OUT</a>
                        </li>
                    </ul>
                </nav>
            )
        } else {
            return (
                <nav class="navbar navbar-default" role="navigation">
                    <ul class="nav navbar-nav">
                        <li>
                            <a href="/">MAIN</a>
                        </li>
                    </ul>
                    <ul class="nav navbar-nav navbar-right">
                        <li>
                            <a href="/login">SIGN IN</a>
                        </li>
                    </ul>
                </nav>
                )
        }
    }
}
module.exports = TopNav;

