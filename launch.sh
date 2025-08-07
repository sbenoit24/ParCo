#!/bin/bash

# Exchequer Launcher Script
echo "🚀 Launching Exchequer - Student Organization Financial Management Platform"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📱 Detected macOS - Opening in default browser..."
    open exchequer.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Detected Linux - Opening in default browser..."
    xdg-open exchequer.html
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "🪟 Detected Windows - Opening in default browser..."
    start exchequer.html
else
    echo "❓ Unknown OS - Please open exchequer.html manually in your browser"
    echo "   File location: $(pwd)/exchequer.html"
fi

echo ""
echo "✅ Exchequer should now be running in your browser!"
echo ""
echo "📚 For help and documentation, see README.md"
echo "🔧 For technical support, check the browser console for errors"
echo ""
echo "🎯 Features available:"
echo "   • Dashboard with financial overview"
echo "   • Dues management and tracking"
echo "   • Expense submission and approval"
echo "   • Member directory management"
echo "   • Events calendar"
echo "   • Budget planning with AI suggestions"
echo "   • Fundraising campaigns"
echo "   • Data export functionality"
echo ""
echo "💡 Tip: The app works offline and stores data locally by default" 