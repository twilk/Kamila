class Chart {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.type = config.type;
        this.data = config.data;
        this.options = config.options;
        
        // Initialize the chart
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        if (this.type === 'bar') {
            this.renderBarChart();
        } else if (this.type === 'line') {
            this.renderLineChart();
        }
    }

    renderBarChart() {
        const ctx = this.ctx;
        const data = this.data;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Calculate dimensions
        const padding = 40;
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);
        
        // Find max value for scaling
        const maxValue = Math.max(...data.datasets[0].data);
        
        // Draw bars
        const barWidth = chartWidth / data.labels.length;
        data.datasets[0].data.forEach((value, index) => {
            const barHeight = (value / maxValue) * chartHeight;
            const x = padding + (index * barWidth);
            const y = height - padding - barHeight;
            
            // Draw bar
            ctx.fillStyle = data.datasets[0].backgroundColor;
            ctx.fillRect(x, y, barWidth * 0.8, barHeight);
            
            // Draw label
            ctx.fillStyle = '#000000';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(data.labels[index], x + (barWidth * 0.4), height - padding + 15);
            
            // Draw value
            ctx.fillText(value.toLocaleString() + ' zł', x + (barWidth * 0.4), y - 5);
        });
    }

    renderLineChart() {
        const ctx = this.ctx;
        const data = this.data;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Calculate dimensions
        const padding = 40;
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);
        
        // Find max value for scaling
        const maxValue = Math.max(...data.datasets.flatMap(dataset => dataset.data));
        
        // Draw lines for each dataset
        data.datasets.forEach(dataset => {
            const points = dataset.data.map((value, index) => ({
                x: padding + (index * (chartWidth / (dataset.data.length - 1))),
                y: height - padding - ((value / maxValue) * chartHeight)
            }));
            
            // Draw line
            ctx.beginPath();
            ctx.strokeStyle = dataset.borderColor;
            ctx.lineWidth = dataset.borderWidth || 2;
            
            points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            
            ctx.stroke();
            
            // Draw points
            points.forEach(point => {
                ctx.beginPath();
                ctx.fillStyle = dataset.borderColor;
                ctx.arc(point.x, point.y, dataset.pointRadius || 3, 0, Math.PI * 2);
                ctx.fill();
            });
        });
        
        // Draw labels
        ctx.fillStyle = '#000000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        data.labels.forEach((label, index) => {
            const x = padding + (index * (chartWidth / (data.labels.length - 1)));
            ctx.fillText(label, x, height - padding + 15);
        });
    }

    update() {
        this.render();
    }

    destroy() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
}

export default Chart; 