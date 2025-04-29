#!/bin/bash

# Создаем иконки разных размеров из SVG
convert -background none -size 192x192 icon-placeholder.svg icon-192x192.png
convert -background none -size 512x512 icon-placeholder.svg icon-512x512.png

# Перемещаем иконки в корневую директорию public
mv icon-192x192.png ../icon-192x192.png
mv icon-512x512.png ../icon-512x512.png

echo "Иконки успешно созданы!"
