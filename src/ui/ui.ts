import cors from 'cors';
import express from 'express';
import { createServer, Server } from 'http';
import socketio from 'socket.io';
import { Rows } from '../row/rows';
import { Stacks } from '../stack/stacks';
import { Stack, StackBase, StackEventType } from '../stack/stack';
import { UILayout } from '../models/model';
import { WidgetType, UIWidget, WidgetEventType, UIWidgetTypes, WidgetBase } from '../widget/widget';
import { UIStack } from '../stack/stack';
import { UIRow } from '../row/row';
import { Widgets } from '../widget/widgets';

class UIManager {
  socket: any;
  callbacks: Map<string, Function[]> = new Map();

  receiveEvent = data => {
    if (this.socket) {
      this.socket.emit('rx', data);
    }
  };

  private app: express.Application;
  private server: Server;
  private io: SocketIO.Server;
  private title: string = '';

  init = (websocketPort: number) => {
    this.listen(websocketPort);
  };

  setTitle = (title: string) => {
    this.title = title;
  };

  constructor() {
    this.app = express();
    this.app.use(cors());
    this.app.options('*', cors());
    this.server = createServer(this.app);
    this.io = socketio(this.server);
  }

  getUILayoutJSON = (): UILayout => {
    let maxInRow = -1;
    let uiLayout: UILayout = { title: this.title, rows: [] };
    Array.from(Rows.getAll()).forEach(row => {
      const uiRow: UIRow = { name: row.name(), weight: row.weight(), stacks: [] };
      row.stacks().forEach(stack => {
        const stackBase: StackBase = stack as StackBase;
        const uiStack: UIStack = {
          name: stackBase.name(),
          context: stackBase.parameter()!.getMetadata('context'),
          label: stackBase.parameter()!.getMetadata('label') === '' ? stackBase.name() : stackBase.parameter()!.getMetadata('label'),
          widgets: [],
          color: stackBase.parameter()!.getMetadata('color'),
          value: stackBase.parameter()!.value(),
        };
        if (stackBase.parameter()!.getMetadata('max')) {
          uiStack.max = stackBase.parameter()!.getMetadata('max');
          uiStack.min = stackBase.parameter()!.getMetadata('min');
        } else if (stackBase.parameter()!.getMetadata('values')) {
          uiStack.values = stackBase.parameter()!.getMetadata('values');
        }
        const widgets = stack.widgets().filter(w => {
          return UIWidgetTypes.includes(w.type());
        });
        widgets.forEach(widget => {
          const uiWidget: UIWidget = { name: widget.name(), type: widget.type(), weight: widget.weight() === undefined ? 1 : widget.weight()! };
          uiStack.widgets.push(uiWidget);
        });
        uiRow.stacks.push(uiStack);
      });
      if (uiRow.stacks.length > maxInRow) maxInRow = uiRow.stacks.length;
      uiLayout.rows.push(uiRow);
    });
    return uiLayout;
  };

  private listen(port: number): void {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}. Specify this in your UI as required.`);
    });

    this.app.get('/', (req, res) => {
      res.send().status(401);
    });

    this.io.on('connect', (socket: any) => {
      this.socket = socket;
      console.log('Connected client on port %s.', port);

      socket.on('client', () => {
        console.log(`Received client request`);
        this.io.sockets.emit('client-ready', 1);
        console.log('Sent client response: 1');

        socket.on('data', (clientId: number) => {
          console.log('Received layout request from client with ID=%d.', clientId);
          console.log(this.getUILayoutJSON());
          this.io.sockets.emit('data', this.getUILayoutJSON());
        });

        socket.on('tx', data => {
          console.log(JSON.stringify(data));
          const widget: WidgetBase | undefined = Widgets.get(data.widget.name) as WidgetBase;
          if (widget) {
            switch (widget.type()) {
              case WidgetType.BUTTON:
                if (data.widget.event === WidgetEventType.PRESS) {
                  widget.onPressed(false);
                }
                break;
              default:
                break;
            }
          }
        });
      });
    });
  }
}

export const UI = new UIManager();
