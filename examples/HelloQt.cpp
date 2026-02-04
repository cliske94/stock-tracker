// Simple Qt GUI example that opens a window and displays "Hello, World!"
// Uses Qt Widgets (Qt5 or Qt6)
#include <QApplication>
#include <QLabel>
#include <QWidget>
#include <QString>

#include <iostream>

int main(int argc, char** argv) {
    QApplication app(argc, argv);

    QString text = QObject::tr("Hello, World!");
    if (argc >= 2) text = QString::fromUtf8(argv[1]);

    QLabel* label = new QLabel(text);
    label->setAlignment(Qt::AlignCenter);
    label->setMinimumSize(480, 160);

    QWidget window;
    window.setWindowTitle("Hello Qt");
    window.setMinimumSize(480, 160);

    // put label inside window layout-free (label will be child of window)
    label->setParent(&window);
    label->move((window.width() - label->width())/2, (window.height() - label->height())/2);
    window.show();

    return app.exec();
}
