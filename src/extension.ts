// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Block Breaker Game extension is now active!');

	// Register the command to start the game
	const disposable = vscode.commands.registerCommand('blockBreaker.startGame', () => {
		BlockBreakerPanel.createOrShow(context.extensionUri);
	});

	context.subscriptions.push(disposable);
}

/**
 * Manages Block Breaker game webview panels
 */
class BlockBreakerPanel {
	/**
	 * Track the currently opened panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: BlockBreakerPanel | undefined;

	public static readonly viewType = 'blockBreaker';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (BlockBreakerPanel.currentPanel) {
			BlockBreakerPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			BlockBreakerPanel.viewType,
			'Block Breaker Game',
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		BlockBreakerPanel.currentPanel = new BlockBreakerPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		BlockBreakerPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Block Breaker Game</title>
    <style>
        body {
            padding: 0;
            margin: 0;
            background: #1e1e1e;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: Arial, sans-serif;
        }
        canvas {
            border: 2px solid #007acc;
            background: #000;
        }
        .game-info {
            position: absolute;
            top: 10px;
            left: 10px;
            color: #fff;
            font-size: 18px;
        }
        .controls {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            color: #fff;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="game-info">
        <div>Score: <span id="score">0</span></div>
        <div>Lives: <span id="lives">3</span></div>
    </div>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <div class="controls">
        <p>Use ← → arrow keys or A/D to move the paddle</p>
        <p>Press SPACE to start/pause the game</p>
    </div>

    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreElement = document.getElementById('score');
        const livesElement = document.getElementById('lives');

        // Game state
        let gameRunning = false;
        let score = 0;
        let lives = 3;

        // Paddle
        const paddle = {
            x: canvas.width / 2 - 50,
            y: canvas.height - 30,
            width: 100,
            height: 10,
            speed: 8
        };

        // Ball
        const ball = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            radius: 8,
            dx: 5,
            dy: -5
        };

        // Blocks
        const blocks = [];
        const blockRows = 6;
        const blockCols = 10;
        const blockWidth = 70;
        const blockHeight = 20;
        const blockPadding = 5;
        const blockOffsetTop = 60;
        const blockOffsetLeft = 35;

        // Initialize blocks
        function initBlocks() {
            blocks.length = 0;
            for (let r = 0; r < blockRows; r++) {
                for (let c = 0; c < blockCols; c++) {
                    blocks.push({
                        x: c * (blockWidth + blockPadding) + blockOffsetLeft,
                        y: r * (blockHeight + blockPadding) + blockOffsetTop,
                        width: blockWidth,
                        height: blockHeight,
                        visible: true,
                        color: \`hsl(\${r * 30}, 70%, 50%)\`
                    });
                }
            }
        }

        // Input handling
        const keys = {};
        
        document.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            if (e.key === ' ') {
                e.preventDefault();
                toggleGame();
            }
        });

        document.addEventListener('keyup', (e) => {
            keys[e.key] = false;
        });

        function toggleGame() {
            gameRunning = !gameRunning;
            if (gameRunning) {
                gameLoop();
            }
        }

        function resetBall() {
            ball.x = canvas.width / 2;
            ball.y = canvas.height / 2;
            ball.dx = (Math.random() > 0.5 ? 1 : -1) * 5;
            ball.dy = -5;
        }

        function resetGame() {
            score = 0;
            lives = 3;
            paddle.x = canvas.width / 2 - paddle.width / 2;
            resetBall();
            initBlocks();
            updateUI();
        }

        function updateUI() {
            scoreElement.textContent = score;
            livesElement.textContent = lives;
        }

        function update() {
            if (!gameRunning) return;

            // Move paddle
            if ((keys['ArrowLeft'] || keys['a'] || keys['A']) && paddle.x > 0) {
                paddle.x -= paddle.speed;
            }
            if ((keys['ArrowRight'] || keys['d'] || keys['D']) && paddle.x < canvas.width - paddle.width) {
                paddle.x += paddle.speed;
            }

            // Move ball
            ball.x += ball.dx;
            ball.y += ball.dy;

            // Ball collision with walls
            if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
                ball.dx = -ball.dx;
            }
            if (ball.y - ball.radius < 0) {
                ball.dy = -ball.dy;
            }

            // Ball collision with paddle
            if (ball.y + ball.radius > paddle.y &&
                ball.x > paddle.x &&
                ball.x < paddle.x + paddle.width &&
                ball.dy > 0) {
                ball.dy = -ball.dy;
                // Add some spin based on where ball hits paddle
                const hitPos = (ball.x - paddle.x) / paddle.width;
                ball.dx = 8 * (hitPos - 0.5);
            }

            // Ball collision with blocks
            for (let i = blocks.length - 1; i >= 0; i--) {
                const block = blocks[i];
                if (block.visible &&
                    ball.x > block.x &&
                    ball.x < block.x + block.width &&
                    ball.y > block.y &&
                    ball.y < block.y + block.height) {
                    ball.dy = -ball.dy;
                    block.visible = false;
                    score += 10;
                    updateUI();
                }
            }

            // Check win condition
            if (blocks.every(block => !block.visible)) {
                gameRunning = false;
                alert('Congratulations! You won!');
                resetGame();
            }

            // Ball fell off screen
            if (ball.y + ball.radius > canvas.height) {
                lives--;
                updateUI();
                if (lives <= 0) {
                    gameRunning = false;
                    alert('Game Over! Press SPACE to restart.');
                    resetGame();
                } else {
                    resetBall();
                }
            }
        }

        function draw() {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw paddle
            ctx.fillStyle = '#007acc';
            ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

            // Draw ball
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw blocks
            blocks.forEach(block => {
                if (block.visible) {
                    ctx.fillStyle = block.color;
                    ctx.fillRect(block.x, block.y, block.width, block.height);
                    ctx.strokeStyle = '#fff';
                    ctx.strokeRect(block.x, block.y, block.width, block.height);
                }
            });

            // Draw game status
            if (!gameRunning) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = '48px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Press SPACE to start', canvas.width / 2, canvas.height / 2);
            }
        }

        function gameLoop() {
            update();
            draw();
            if (gameRunning) {
                requestAnimationFrame(gameLoop);
            }
        }

        // Initialize game
        resetGame();
        draw();
    </script>
</body>
</html>`;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
